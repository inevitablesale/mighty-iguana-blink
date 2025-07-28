// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function callGemini(prompt, apiKey, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
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

      if (geminiResponse.status === 503) {
        if (i < retries - 1) {
          console.warn(`Gemini API returned 503. Retrying in ${delay / 1000}s... (${i + 1}/${retries})`);
          await new Promise(res => setTimeout(res, delay));
          delay *= 2; // Exponential backoff
          continue;
        } else {
          throw new Error(`Gemini API error: The model is overloaded. Please try again later. (Status: 503)`);
        }
      }

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
    } catch (error) {
      if (i === retries - 1) throw error;
    }
  }
  throw new Error("Gemini API call failed after multiple retries.");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { proactiveOpportunityId } = await req.json();
    if (!proactiveOpportunityId) throw new Error("Proactive Opportunity ID is required.");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const userRes = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
    if (userRes.error) throw new Error("Authentication failed");
    const user = userRes.data.user;

    const { data: proactiveOpp, error: fetchError } = await supabaseAdmin
      .from('proactive_opportunities')
      .select('id, job_data, relevance_score, relevance_reasoning, user_id')
      .eq('id', proactiveOpportunityId)
      .single();

    if (fetchError) throw new Error(`Failed to fetch proactive opportunity: ${fetchError.message}`);
    if (!proactiveOpp) throw new Error("Proactive opportunity not found.");
    if (proactiveOpp.user_id && proactiveOpp.user_id !== user.id) {
      throw new Error("This opportunity is assigned to another user.");
    }

    const job = proactiveOpp.job_data;
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");

    const enrichmentPrompt = `
        You are a world-class recruiting strategist. Analyze the following job posting.
        Job Posting: ${JSON.stringify(job)}
        
        Your task is to return a single, valid JSON object with all the requested keys: "companyName", "role", "location", "company_overview", "contract_value_assessment", "hiring_urgency", "pain_points", "recruiter_angle", "key_signal_for_outreach", "placement_difficulty", "estimated_time_to_fill", "client_demand_signal", "location_flexibility", "seniority_level", "likely_decision_maker".

        **Detailed Instructions for Intelligence Fields:**
        - "contract_value_assessment": If a salary is in the job data, calculate 20% of the average and return "Est. Fee: $XX,XXX". If not, estimate a realistic market-rate salary for the role/location, then do the same calculation.
        - "hiring_urgency": Return one of: 'High', 'Medium', or 'Low'.
        - "placement_difficulty": Return one of: 'High', 'Medium', or 'Low'.
        - "estimated_time_to_fill": Return a string like "25-40 days".
        - "client_demand_signal": Return a descriptive string like "High - multiple roles open" or "Standard - single position".
        - "location_flexibility": Return one of: "Remote", "Hybrid", or "Onsite".
        - "seniority_level": Return one of: "Executive", "Senior", "Mid-level", "Entry-level".
        - "likely_decision_maker": Infer the most likely job title of the hiring manager.
      `;
    const analysisData = await callGemini(enrichmentPrompt, GEMINI_API_KEY);

    const newOpportunity = {
      user_id: user.id,
      company_name: analysisData.companyName || job.company,
      role: analysisData.role || job.title,
      location: analysisData.location || job.location,
      match_score: proactiveOpp.relevance_score,
      key_signal_for_outreach: analysisData.key_signal_for_outreach || proactiveOpp.relevance_reasoning,
      company_overview: analysisData.company_overview,
      contract_value_assessment: analysisData.contract_value_assessment,
      hiring_urgency: analysisData.hiring_urgency,
      pain_points: analysisData.pain_points,
      recruiter_angle: analysisData.recruiter_angle,
      placement_difficulty: analysisData.placement_difficulty,
      estimated_time_to_fill: analysisData.estimated_time_to_fill,
      client_demand_signal: analysisData.client_demand_signal,
      location_flexibility: analysisData.location_flexibility,
      seniority_level: analysisData.seniority_level,
      likely_decision_maker: analysisData.likely_decision_maker,
    };

    const { data: savedOpportunity, error: insertOppError } = await supabaseAdmin
      .from('opportunities')
      .insert(newOpportunity)
      .select()
      .single();
    
    if (insertOppError) throw new Error(`Failed to create opportunity: ${insertOppError.message}`);

    const newCampaign = {
      user_id: user.id,
      opportunity_id: savedOpportunity.id,
      company_name: savedOpportunity.company_name,
      role: savedOpportunity.role,
      status: 'draft',
    };

    const { data: savedCampaign, error: insertCampaignError } = await supabaseAdmin
      .from('campaigns')
      .insert(newCampaign)
      .select()
      .single();

    if (insertCampaignError) throw new Error(`Failed to create campaign: ${insertCampaignError.message}`);

    await supabaseAdmin
      .from('proactive_opportunities')
      .update({ status: 'accepted', user_id: user.id })
      .eq('id', proactiveOpportunityId);

    return new Response(JSON.stringify({ campaign: savedCampaign }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Accept Proactive Opportunity Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});