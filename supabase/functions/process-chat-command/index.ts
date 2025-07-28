// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Re-using helper functions from previous versions
async function callGemini(prompt, apiKey) {
  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      }),
    }
  );
  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text();
    throw new Error(`Gemini API error: ${geminiResponse.statusText} - ${errorText}`);
  }
  const geminiResult = await geminiResponse.json();
  const aiResponseText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!aiResponseText) throw new Error("Failed to get a valid response from Gemini.");
  try {
    return JSON.parse(aiResponseText);
  } catch (e) {
    console.error("Failed to parse Gemini JSON response:", aiResponseText);
    throw new Error(`JSON parsing error: ${e.message}`);
  }
}

function extractLinkedInSlug(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname.includes('linkedin.com') && parsedUrl.pathname.startsWith('/company/')) {
      const parts = parsedUrl.pathname.split('/');
      return parts[2]?.replace(/\/$/, '') || null;
    }
  } catch (e) { /* Ignore invalid URLs */ }
  return null;
}

async function createJobHash(job) {
  const jobString = `${job.title}|${job.company}|${job.location}|${job.description?.substring(0, 500)}`;
  const data = new TextEncoder().encode(jobString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function sanitizeMatchScore(score) {
  if (!score) return 0;
  const cleanedScore = String(score).replace(/[^0-9.]/g, '');
  let numScore = parseFloat(cleanedScore);
  if (isNaN(numScore)) return 0;
  if (numScore > 10) numScore /= 10;
  return Math.max(0, Math.min(10, Math.round(numScore)));
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query) throw new Error("Search query is required.");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const userRes = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
    if (userRes.error) throw new Error("Authentication failed");
    const user = userRes.data.user;

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY secret is not set.");

    const intent = "find_opportunities";

    if (intent === "find_opportunities") {
        const searchQueryPrompt = `
          You are an expert at parsing recruitment-focused search queries. Your task is to deconstruct the user's query into components for a job search API.
          User Query: "${query}"

          1.  **Identify the Job Role/Title:** Extract the core job title or keywords the user is looking for. This will be the \`search_query\`. It should ONLY contain the role, not company descriptions (e.g., "senior software engineer", "head of sales").
          2.  **Identify the Location:** Extract the geographical location. Default to "Remote" if not specified.
          3.  **Define the Recruiter's Specialty:** Create a concise \`recruiter_specialty\` string that captures the user's full intent, including company characteristics (e.g., "placing sales leaders in recently funded startups in San Francisco"). This will be used for post-search analysis.
          4.  **Select Search Sites:** Choose the appropriate job sites. For most professional roles in the US or Europe, use 'linkedin,indeed,zip_recruiter,glassdoor,google'.

          Return ONLY a single, valid JSON object with keys: "search_query", "location", "sites", and "recruiter_specialty".
        `;
        const { search_query, location, sites, recruiter_specialty } = await callGemini(searchQueryPrompt, GEMINI_API_KEY);
        if (!search_query || !location || !sites || !recruiter_specialty) throw new Error("AI failed to extract search parameters from your query.");

        const scrapingUrl = `https://coogi-jobspy-production.up.railway.app/jobs?query=${encodeURIComponent(search_query)}&location=${encodeURIComponent(location)}&sites=${sites}&results=10`; // Limit for chat
        const scrapingResponse = await fetch(scrapingUrl, { signal: AbortSignal.timeout(45000) });
        if (!scrapingResponse.ok) throw new Error(`Job scraping API failed: ${await scrapingResponse.text()}`);
        const scrapingData = await scrapingResponse.json();
        const rawJobResults = scrapingData?.jobs;

        if (!rawJobResults || rawJobResults.length === 0) {
          return new Response(JSON.stringify({ text: "I couldn't find any open roles matching your request. Please try a different search." }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const enrichmentPromises = rawJobResults.map(async (job) => {
          const jobHash = await createJobHash(job);
          const { data: cached } = await supabaseAdmin.from('job_analysis_cache').select('analysis_data').eq('job_hash', jobHash).single();
          
          if (cached) {
            const sanitizedData = cached.analysis_data;
            sanitizedData.match_score = sanitizeMatchScore(sanitizedData.match_score || sanitizedData.matchScore);
            sanitizedData.linkedin_url_slug = extractLinkedInSlug(job.company_linkedin_url);
            return sanitizedData;
          }

          const singleEnrichmentPrompt = `
            You are a world-class recruiting strategist. Analyze the following job posting based on a recruiter's stated specialty.
            Recruiter's specialty: "${recruiter_specialty}"
            Job Posting: ${JSON.stringify(job)}
            Return a single, valid JSON object with keys: "companyName", "role", "location", "company_overview", "match_score", "contract_value_assessment", "hiring_urgency", "pain_points", "recruiter_angle", "key_signal_for_outreach", and "placement_difficulty".
            
            **"match_score"**: MUST be an integer between 1 and 10.
            
            **"contract_value_assessment"**: This is your most important task. You MUST follow these rules without deviation.
            - **RULE 1: CHECK FOR SALARY.** Look for a salary range in the job description text.
            - **RULE 2: CALCULATE FEE.** If a salary range is found, you MUST calculate the fee using this formula: \`Fee = ( (Min_Salary + Max_Salary) / 2 ) * 0.20\`.
            - **RULE 3: FORMAT FEE.** The result of the calculation MUST be formatted as a string: \`Est. Fee: $XX,XXX\`.
            - **EXAMPLE:**
                - Job Description contains: "salary for this role is $150,000 to $170,000 per year".
                - Calculation: (($150000 + $170000) / 2) * 0.20 = $32,000.
                - Your output for this key MUST be the string: "Est. Fee: $32,000".
            - **RULE 4: NO SALARY FALLBACK.** If and ONLY if no salary range is present, you MUST return the string 'High Value'.
            - **FINAL CHECK:** Before outputting, verify your value for this key. Is it 'Est. Fee: $XX,XXX' or 'High Value'? If not, you have failed. Fix it.

            **"placement_difficulty"**: MUST be one of 'Low', 'Medium', or 'High'.
            **"hiring_urgency"**: MUST be one of 'Low', 'Medium', or 'High'.
            **"recruiter_angle"**: A concise sentence describing the best way for a staffing agency to position their value.
          `;
          const analysisData = await callGemini(singleEnrichmentPrompt, GEMINI_API_KEY);
          
          analysisData.match_score = sanitizeMatchScore(analysisData.match_score || analysisData.matchScore);
          analysisData.linkedin_url_slug = extractLinkedInSlug(job.company_linkedin_url);

          await supabaseAdmin.from('job_analysis_cache').insert({ job_hash: jobHash, analysis_data: analysisData });
          
          return analysisData;
        });

        const settledEnrichments = await Promise.allSettled(enrichmentPromises);
        const enrichedOpportunities = [];
        for (const result of settledEnrichments) {
          if (result.status === 'fulfilled' && result.value) {
            enrichedOpportunities.push(result.value);
          }
        }

        const highQualityOpportunities = enrichedOpportunities
          .filter(opp => opp.match_score >= 6)
          .sort((a, b) => b.match_score - a.match_score);

        if (highQualityOpportunities.length === 0) {
            return new Response(JSON.stringify({ text: "I found some roles, but after analysis, none seemed to be a strong match. Try refining your search." }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const opportunitiesToInsert = highQualityOpportunities.map(opp => ({
            user_id: user.id,
            company_name: opp.companyName || opp.company_name,
            role: opp.role,
            location: opp.location || 'N/A',
            company_overview: opp.company_overview || 'N/A',
            match_score: opp.match_score,
            contract_value_assessment: opp.contract_value_assessment || 'N/A',
            hiring_urgency: opp.hiring_urgency || 'N/A',
            pain_points: opp.pain_points || 'N/A',
            recruiter_angle: opp.recruiter_angle || 'N/A',
            key_signal_for_outreach: opp.key_signal_for_outreach || 'N/A',
            linkedin_url_slug: opp.linkedin_url_slug || null,
            placement_difficulty: opp.placement_difficulty || 'Medium',
        }));

        const { data: savedOpportunities, error: insertOppError } = await supabaseAdmin.from('opportunities').insert(opportunitiesToInsert).select();
        if (insertOppError) throw new Error(`Failed to save opportunities: ${insertOppError.message}`);

        savedOpportunities.sort((a, b) => b.match_score - a.match_score);

        return new Response(JSON.stringify({
          text: `I found ${savedOpportunities.length} potential deals for you. Here are the top matches:`,
          opportunities: savedOpportunities,
          searchParams: {
            recruiter_specialty: recruiter_specialty
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
    }

    // Fallback for other intents
    return new Response(JSON.stringify({ text: "I'm sorry, I can't help with that yet." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Chat Command Error:", error.message);
    return new Response(JSON.stringify({ error: `An error occurred: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});