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

    // Fetch top 4 highest-scored proactive opportunities that are reviewed and unassigned
    const { data: topProactive, error: fetchError } = await supabaseAdmin
      .from('proactive_opportunities')
      .select('job_data, relevance_score')
      .eq('status', 'reviewed')
      .is('user_id', null)
      .order('relevance_score', { ascending: false })
      .limit(4);

    if (fetchError) throw new Error(`Failed to fetch featured opportunities: ${fetchError.message}`);
    
    if (!topProactive || topProactive.length === 0) {
        console.log("[get-featured-opportunities] No reviewed, unassigned opportunities found. Returning empty array.");
        return new Response(JSON.stringify({ opportunities: [] }), { status: 200, headers: corsHeaders });
    }
    
    console.log(`[get-featured-opportunities] Found ${topProactive.length} pre-scored proactive opportunities.`);
    const opportunitiesToEnrich = topProactive.map(opp => ({ job: opp.job_data, score: opp.relevance_score }));

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
        - "seniority_level": 'Executive', 'Senior', 'Mid-level', 'Entry-level'.
      `;
      
      const analysisData = await callGemini(enrichmentPrompt, GEMINI_API_KEY);
      
      // Combine with data we already have
      return {
        id: crypto.randomUUID(), // Generate a temp ID for the key prop
        ...analysisData,
        match_score: item.score,
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