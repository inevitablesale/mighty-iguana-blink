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
    
    const userRes = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
    if (userRes.error) throw new Error("Authentication failed");
    const user = userRes.data.user;

    const { data: opportunities, error: oppError } = await supabaseAdmin
      .from('proactive_opportunities')
      .select('id, job_data, relevance_score, relevance_reasoning, user_id')
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .eq('status', 'reviewed')
      .order('relevance_score', { ascending: false });

    if (oppError) throw oppError;
    if (!opportunities || opportunities.length === 0) {
      return new Response(JSON.stringify({ opportunities: [] }), { status: 200, headers: corsHeaders });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");

    const enrichmentPromises = opportunities.map(async (opp) => {
      const enrichmentPrompt = `
        You are a recruiting analyst. Analyze the following job data and extract key intelligence points.
        Job Data: ${JSON.stringify(opp.job_data)}
        
        Return a single, valid JSON object with the following keys:
        - "contract_value_assessment": If salary is present, calculate a 20% fee (e.g., "Est. Fee: $XX,XXX"). If not, estimate a value based on the role and return the same format.
        - "hiring_urgency": 'High', 'Medium', or 'Low'.
        - "placement_difficulty": 'High', 'Medium', or 'Low'.
        - "seniority_level": 'Executive', 'Senior', 'Mid-level', 'Entry-level'.
      `;
      
      try {
        const analysisData = await callGemini(enrichmentPrompt, GEMINI_API_KEY);
        return { ...opp, ...analysisData };
      } catch (e) {
        console.error(`Enrichment failed for opp ${opp.id}:`, e.message);
        return opp; // Return original opp on failure
      }
    });

    const enrichedOpportunities = await Promise.all(enrichmentPromises);

    return new Response(JSON.stringify({ opportunities: enrichedOpportunities }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Get Enriched Proactive Opportunities Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});