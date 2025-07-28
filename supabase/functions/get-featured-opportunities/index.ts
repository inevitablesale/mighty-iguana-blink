// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  if (!geminiResponse.ok) throw new Error(`Gemini API error: ${await geminiResponse.text()}`);
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

async function createJobHash(job) {
  const jobString = `${job.title}|${job.company}|${job.location}|${job.description?.substring(0, 500)}`;
  const data = new TextEncoder().encode(jobString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const FEATURED_QUERIES = [
  { query: "VP of Engineering", location: "USA" },
  { query: "Director of Sales", location: "USA" },
  { query: "Head of Product", location: "Remote" },
  { query: "Chief Marketing Officer", location: "USA" },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");

    const search = FEATURED_QUERIES[Math.floor(Math.random() * FEATURED_QUERIES.length)];

    const scrapingUrl = `https://coogi-jobspy-production.up.railway.app/jobs?query=${encodeURIComponent(search.query)}&location=${encodeURIComponent(search.location)}&sites=linkedin,google,zip_recruiter&results=25&enforce_annual_salary=true`;
    const scrapingResponse = await fetch(scrapingUrl, { signal: AbortSignal.timeout(45000) });
    if (!scrapingResponse.ok) throw new Error(`Job scraping API failed: ${await scrapingResponse.text()}`);
    const scrapingData = await scrapingResponse.json();
    const rawJobResults = scrapingData?.jobs;

    if (!rawJobResults || rawJobResults.length === 0) {
      return new Response(JSON.stringify({ opportunities: [] }), { status: 200, headers: corsHeaders });
    }

    const sortedJobs = rawJobResults
      .filter(job => job.max_amount && job.max_amount > 0)
      .sort((a, b) => b.max_amount - a.max_amount);

    const topJobs = sortedJobs.slice(0, 10);

    const enrichmentPromises = topJobs.map(async (job) => {
      const jobHash = await createJobHash(job);
      const { data: cached } = await supabaseAdmin.from('job_analysis_cache').select('analysis_data').eq('job_hash', jobHash).single();
      
      if (cached) {
        cached.analysis_data.match_score = 10;
        return cached.analysis_data;
      }

      const singleEnrichmentPrompt = `
        You are a world-class recruiting strategist. Analyze the following job posting.
        Job Posting: ${JSON.stringify(job)}
        Return a single, valid JSON object with keys: "companyName", "role", "location", "company_overview", "contract_value_assessment", "hiring_urgency", "pain_points", "recruiter_angle", "key_signal_for_outreach", "placement_difficulty", "seniority_level".
        **The "contract_value_assessment" is the most important field. Analyze the job description for salary information. If a salary range is found (e.g., $200k - $250k), calculate the average salary ($225k), take 20% of that to estimate the placement fee ($45k), and return a string like 'Est. Fee: $45,000'. If no salary is found, YOU MUST estimate a realistic market-rate salary for this executive role and location, then do the same calculation. Be generous in your estimation.**
        **Crucially, ensure that any double quotes within the string values of the final JSON are properly escaped with a backslash (e.g., "some \\"quoted\\" text").**
      `;
      const analysisData = await callGemini(singleEnrichmentPrompt, GEMINI_API_KEY);
      
      analysisData.match_score = 10;
      
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

    const opportunitiesToReturn = enrichedOpportunities.map(opp => ({
        id: crypto.randomUUID(),
        company_name: opp.companyName,
        role: opp.role,
        location: opp.location,
        company_overview: opp.company_overview,
        contract_value_assessment: opp.contract_value_assessment,
        hiring_urgency: opp.hiring_urgency,
        pain_points: opp.pain_points,
        recruiter_angle: opp.recruiter_angle,
        key_signal_for_outreach: opp.key_signal_for_outreach,
        placement_difficulty: opp.placement_difficulty,
        seniority_level: opp.seniority_level,
        match_score: opp.match_score,
    })).slice(0, 4);

    return new Response(JSON.stringify({ opportunities: opportunitiesToReturn }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Get Featured Opportunities Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});