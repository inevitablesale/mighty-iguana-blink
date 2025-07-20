// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createHash } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to create a consistent hash for a job object
function createJobHash(job) {
  const hash = createHash("sha-256");
  const jobString = `${job.title}|${job.company}|${job.location}|${job.description?.substring(0, 500)}`;
  hash.update(jobString);
  return hash.toString();
}

// Helper function to call Gemini API
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


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentId } = await req.json();
    if (!agentId) throw new Error("Agent ID is required.");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const userRes = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
    if (userRes.error) throw new Error("Authentication failed");
    const user = userRes.data.user;

    const { data: agent, error: agentError } = await supabaseAdmin.from('agents').select('prompt, autonomy_level, search_lookback_hours, max_results, job_type, is_remote, country').eq('id', agentId).eq('user_id', user.id).single();
    if (agentError) throw new Error(`Failed to fetch agent: ${agentError.message}`);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY secret is not set.");

    // --- Step 1: Generate search query ---
    const searchQueryPrompt = `
      Based on the following recruiter specialty description, extract a search query (the core job title or keywords) and a location (city/state/province). **The search query should NOT contain the location name.**
      Recruiter Specialty: "${agent.prompt}"
      Available sites are: linkedin, indeed, zip_recruiter, glassdoor, google, bayt, naukri.
      For most professional roles in the US or Europe, use 'linkedin,indeed,zip_recruiter,glassdoor,google'. If the specialty mentions India, include 'naukri'. If it mentions the Middle East, include 'bayt'.
      If no specific location is mentioned, default the location to "Remote".
      Return ONLY a single, valid JSON object with three keys: "search_query", "location", and "sites".
    `;
    const queryExtractionResult = await callGemini(searchQueryPrompt, GEMINI_API_KEY);
    const { search_query: searchQuery, location, sites } = queryExtractionResult;
    if (!searchQuery || !location || !sites) throw new Error("AI failed to extract search parameters.");

    // --- Step 2: Scrape Jobs ---
    const lookbackHours = parseInt(agent.search_lookback_hours, 10) || 720;
    const maxResults = parseInt(agent.max_results, 10) || 20;
    let scrapingUrl = `https://coogi-jobspy-production.up.railway.app/jobs?query=${encodeURIComponent(searchQuery)}&location=${encodeURIComponent(location)}&sites=${sites}&results=${maxResults}`;
    const usesIndeedOrGlassdoor = sites.includes('indeed') || sites.includes('glassdoor');
    if (usesIndeedOrGlassdoor && agent.country) scrapingUrl += `&country_indeed=${agent.country}`;
    if (usesIndeedOrGlassdoor) {
      if (agent.job_type || agent.is_remote) {
        if (agent.job_type) scrapingUrl += `&job_type=${agent.job_type}`;
        if (agent.is_remote) scrapingUrl += `&is_remote=true`;
      } else {
        scrapingUrl += `&hours_old=${lookbackHours}`;
      }
    } else {
      scrapingUrl += `&hours_old=${lookbackHours}`;
      if (agent.job_type) scrapingUrl += `&job_type=${agent.job_type}`;
      if (agent.is_remote) scrapingUrl += `&is_remote=true`;
    }
    const scrapingResponse = await fetch(scrapingUrl, { signal: AbortSignal.timeout(30000) });
    if (!scrapingResponse.ok) throw new Error(`Job scraping API failed: ${await scrapingResponse.text()}`);
    const scrapingData = await scrapingResponse.json();
    const rawJobResults = scrapingData?.jobs;
    if (!rawJobResults || rawJobResults.length === 0) {
      await supabaseAdmin.from('agents').update({ last_run_at: new Date().toISOString() }).eq('id', agentId);
      return new Response(JSON.stringify({ message: `Agent ran but found no new job opportunities.` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- Step 3: Enrich data with AI analysis, using caching ---
    console.log(`Step 3: Enriching ${rawJobResults.length} jobs, checking cache first...`);
    const enrichmentPromises = rawJobResults.map(async (job) => {
      const jobHash = createJobHash(job);
      const { data: cached, error: cacheError } = await supabaseAdmin.from('job_analysis_cache').select('analysis_data').eq('job_hash', jobHash).single();
      
      if (cached && !cacheError) {
        console.log(`Cache hit for job: ${job.title}`);
        return cached.analysis_data;
      }

      console.log(`Cache miss for job: ${job.title}. Calling AI...`);
      const singleEnrichmentPrompt = `
        You are a world-class recruiting strategist. Analyze the following job posting based on a recruiter's specialty.
        Recruiter's specialty: "${agent.prompt}"
        Job Posting: ${JSON.stringify(job)}
        Return a single, valid JSON object with keys: "companyName", "role", "location", "company_overview", "match_score", "contract_value_assessment", "hiring_urgency", "pain_points", "recruiter_angle", "key_signal_for_outreach".
        **Crucially, ensure that any double quotes within the string values of the final JSON are properly escaped with a backslash (e.g., "some \\"quoted\\" text").**
      `;
      const analysisData = await callGemini(singleEnrichmentPrompt, GEMINI_API_KEY);
      
      const { error: insertCacheError } = await supabaseAdmin.from('job_analysis_cache').insert({ job_hash: jobHash, analysis_data: analysisData });
      if (insertCacheError) console.error(`Failed to cache analysis for ${job.title}:`, insertCacheError.message);
      
      return analysisData;
    });

    const settledEnrichments = await Promise.allSettled(enrichmentPromises);
    const enrichedOpportunities = settledEnrichments
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);

    if (enrichedOpportunities.length === 0) throw new Error("AI analysis failed to enrich any opportunities.");

    // --- Step 4: Validate and Save Enriched Opportunities ---
    const validatedOpportunities = enrichedOpportunities
      .map(opp => {
        const matchScore = parseInt(opp.match_score || opp.matchScore || '0', 10);
        return {
          user_id: user.id,
          agent_id: agentId,
          company_name: opp.companyName || opp.company_name,
          role: opp.role,
          location: opp.location || 'N/A',
          company_overview: opp.company_overview || 'N/A',
          match_score: isNaN(matchScore) ? 0 : matchScore,
          contract_value_assessment: opp.contract_value_assessment || 'N/A',
          hiring_urgency: opp.hiring_urgency || 'N/A',
          pain_points: opp.pain_points || 'N/A',
          recruiter_angle: opp.recruiter_angle || 'N/A',
          key_signal_for_outreach: opp.key_signal_for_outreach || 'N/A',
        };
      })
      .filter(opp => opp.company_name && opp.role); // Ensure required fields are present

    if (validatedOpportunities.length === 0) {
       throw new Error("No valid opportunities to save after validation.");
    }

    const { data: savedOpportunities, error: insertOppError } = await supabaseAdmin.from('opportunities').insert(validatedOpportunities).select();
    if (insertOppError) throw new Error(`Failed to save opportunities: ${insertOppError.message}`);

    // --- Step 5: Conditional Outreach Generation ---
    let outreachMessage = '';
    if (agent.autonomy_level === 'semi-automatic' || agent.autonomy_level === 'automatic') {
        const { data: profile } = await supabaseAdmin.from('profiles').select('first_name, calendly_url').eq('id', user.id).single();
        const campaignPromises = savedOpportunities.map(async (opp) => {
            try {
                const outreachPrompt = `
                  You are an expert copywriter for a recruiter. Write a concise, personalized cold email.
                  Recruiter's name: ${profile?.first_name || 'your partner at Coogi'}.
                  Recruiter's specialties: "${agent.prompt}".
                  Opportunity: Company: ${opp.company_name}, Role: ${opp.role}, Key Signal: "${opp.key_signal_for_outreach}".
                  Calendly: ${profile?.calendly_url || '(not provided)'}.
                  Return a JSON object with keys: "subject", "body", "contact_name" (plausible job title), and "contact_email" (best-guess email).
                  **Crucially, ensure that any double quotes within the string values of the final JSON are properly escaped with a backslash (e.g., "some \\"quoted\\" text").**
                `;
                const outreachResult = await callGemini(outreachPrompt, GEMINI_API_KEY);
                return {
                    user_id: user.id, opportunity_id: opp.id, company_name: opp.company_name, role: opp.role,
                    subject: outreachResult.subject, body: outreachResult.body, status: agent.autonomy_level === 'automatic' ? 'sent' : 'draft',
                    contact_name: outreachResult.contact_name, contact_email: outreachResult.contact_email,
                };
            } catch (e) { return null; }
        });
        const campaignsToInsert = (await Promise.all(campaignPromises)).filter(c => c !== null);
        if (campaignsToInsert.length > 0) {
            await supabaseAdmin.from('campaigns').insert(campaignsToInsert);
        }
        outreachMessage = agent.autonomy_level === 'automatic' ? `and automatically sent ${campaignsToInsert.length} emails.` : `and created ${campaignsToInsert.length} drafts.`;
    }

    // --- Step 6: Finalize ---
    await supabaseAdmin.from('agents').update({ last_run_at: new Date().toISOString() }).eq('id', agentId);
    const message = `Agent run complete. Found and saved ${savedOpportunities.length} new opportunities ${outreachMessage}`;
    return new Response(JSON.stringify({ message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("Edge Function error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});