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

const FALLBACK_SEARCHES = [
    { query: "senior software engineer", location: "Remote" },
    { query: "head of sales", location: "USA" },
    { query: "principal product manager", location: "USA" },
    { query: "engineering manager", location: "Remote" },
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

    // Fetch top 4 highest-scored proactive opportunities, regardless of user
    const { data: topProactive, error: fetchError } = await supabaseAdmin
      .from('proactive_opportunities')
      .select('job_data, relevance_score')
      .not('relevance_score', 'is', null)
      .order('relevance_score', { ascending: false })
      .limit(4);

    if (fetchError) throw new Error(`Failed to fetch featured opportunities: ${fetchError.message}`);
    
    let opportunitiesToEnrich = [];
    let sourceIsProactive = false;

    if (topProactive && topProactive.length > 0) {
        console.log(`[get-featured-opportunities] Found ${topProactive.length} pre-scored proactive opportunities.`);
        opportunitiesToEnrich = topProactive.map(opp => ({ job: opp.job_data, score: opp.relevance_score }));
        sourceIsProactive = true;
    } else {
        // FALLBACK LOGIC: Perform a live search if no proactive opportunities are found
        const randomSearch = FALLBACK_SEARCHES[Math.floor(Math.random() * FALLBACK_SEARCHES.length)];
        const scrapingUrl = `https://coogi-jobspy-production.up.railway.app/jobs?query=${encodeURIComponent(randomSearch.query)}&location=${encodeURIComponent(randomSearch.location)}&sites=linkedin,google&results=10&enforce_annual_salary=true`;
        
        console.log(`[get-featured-opportunities] No proactive opportunities found. Performing live fallback search: ${scrapingUrl}`);
        const scrapingResponse = await fetch(scrapingUrl, { signal: AbortSignal.timeout(30000) });
        if (!scrapingResponse.ok) {
            console.error(`Fallback job scraping failed: ${await scrapingResponse.text()}`);
            return new Response(JSON.stringify({ opportunities: [] }), { status: 200, headers: corsHeaders });
        }
        
        const scrapingData = await scrapingResponse.json();
        const rawJobResults = scrapingData?.jobs;
        console.log(`[get-featured-opportunities] Fallback search returned ${rawJobResults?.length || 0} raw results.`);

        if (rawJobResults && rawJobResults.length > 0) {
            const sortedJobs = rawJobResults
                .filter(job => job.max_amount && job.max_amount > 0)
                .sort((a, b) => b.max_amount - a.max_amount)
                .slice(0, 4);
            
            console.log(`[get-featured-opportunities] Filtered to ${sortedJobs.length} top-paying fallback jobs.`);
            opportunitiesToEnrich = sortedJobs.map(job => ({ job, score: null }));
        }
    }

    if (opportunitiesToEnrich.length === 0) {
      console.log("[get-featured-opportunities] No opportunities to enrich. Returning empty array.");
      return new Response(JSON.stringify({ opportunities: [] }), { status: 200, headers: corsHeaders });
    }

    // Enrich each one to match the `Opportunity` type for the UI card
    const enrichmentPromises = opportunitiesToEnrich.map(async (item) => {
      const job = item.job;
      
      const enrichmentPrompt = `
        You are a recruiting analyst. Analyze the following job data and format it for display on a summary card.
        Job Data: ${JSON.stringify(job)}
        
        Return a single, valid JSON object with the following keys:
        - "company_name": The company name.
        - "role": The job title.
        - "location": The job location.
        - "contract_value_assessment": If salary is present, calculate a 20% fee (e.g., "Est. Fee: $XX,XXX"). If not, estimate a value based on the role and return the same format.
        - "hiring_urgency": 'High', 'Medium', or 'Low'.
        - "placement_difficulty": 'High', 'Medium', or 'Low'.
        - "company_overview": A brief, one-sentence overview of the company.
        - "pain_points": A brief summary of likely pain points.
        - "recruiter_angle": A brief summary of the recruiter angle.
        - "key_signal_for_outreach": A brief summary of the key signal.
        - "seniority_level": 'Executive', 'Senior', 'Mid-level', or 'Entry-level'.
      `;
      
      const analysisData = await callGemini(enrichmentPrompt, GEMINI_API_KEY);
      
      // Combine with data we already have
      return {
        id: crypto.randomUUID(), // Generate a temp ID for the key prop
        ...analysisData,
        match_score: sourceIsProactive ? item.score : 8, // Assign a default high score for featured jobs
      };
    });

    const settledEnrichments = await Promise.allSettled(enrichmentPromises);
    const opportunities = settledEnrichments
      .filter(res => res.status === 'fulfilled' && res.value)
      .map(res => res.value);

    console.log(`[get-featured-opportunities] Returning ${opportunities.length} enriched opportunities to the client.`);
    return new Response(JSON.stringify({ opportunities }), {
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