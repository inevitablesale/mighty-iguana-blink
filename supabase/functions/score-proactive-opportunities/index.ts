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
    console.log("[score-proactive-opportunities] Function invoked.");
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, intent_profile')
      .not('intent_profile', 'is', null);

    if (profileError) throw new Error(`Failed to fetch user profiles: ${profileError.message}`);

    const { data: opportunities, error: oppError } = await supabaseAdmin
      .from('proactive_opportunities')
      .select('id, job_data')
      .eq('status', 'new')
      .limit(50); // Process in batches to avoid timeouts

    if (oppError) throw new Error(`Failed to fetch new opportunities: ${oppError.message}`);
    if (!opportunities || opportunities.length === 0) {
      return new Response(JSON.stringify({ message: "No new opportunities to score." }), { status: 200, headers: corsHeaders });
    }
    
    console.log(`[score-proactive-opportunities] Found ${opportunities.length} new opportunities to score against ${profiles?.length || 0} user profiles.`);
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");

    const assignedOppIds = new Set();

    const enrichmentPromptTemplate = (jobData) => `
        You are a recruiting analyst. Analyze the following job data and extract key intelligence points.
        Job Data: ${JSON.stringify(jobData)}
        
        Return a single, valid JSON object with the following keys:
        - "contract_value_assessment": If salary is present, calculate a 20% fee (e.g., "Est. Fee: $XX,XXX"). If not, estimate a value based on the role and return the same format.
        - "hiring_urgency": 'High', 'Medium', or 'Low'.
        - "placement_difficulty": 'High', 'Medium', or 'Low'.
        - "seniority_level": 'Executive', 'Senior', 'Mid-level', 'Entry-level'.
      `;

    // First pass: Score against user profiles
    if (profiles && profiles.length > 0) {
        for (const profile of profiles) {
            if (!profile.intent_profile?.summary) continue;

            for (const opportunity of opportunities) {
                if (assignedOppIds.has(opportunity.id)) continue; // Already assigned

                const scoringPrompt = `
                  You are a contract lead generator for a recruiting firm.
                  Score this role as a BD lead based on the recruiter’s intent:
                  Recruiter Profile: "${profile.intent_profile.summary}"
                  Job: ${JSON.stringify(opportunity.job_data)}

                  Return a JSON object with:
                  - "relevance_score" (1–10)
                  - "relevance_reasoning" (why this is a promising contract win opportunity)
                `;

                try {
                    const result = await callGemini(scoringPrompt, GEMINI_API_KEY);
                    
                    if (result && result.relevance_score >= 7) { // Higher threshold for personal assignment
                        const enrichedData = await callGemini(enrichmentPromptTemplate(opportunity.job_data), GEMINI_API_KEY);

                        await supabaseAdmin
                        .from('proactive_opportunities')
                        .update({
                            relevance_score: result.relevance_score,
                            relevance_reasoning: result.relevance_reasoning,
                            status: 'reviewed',
                            user_id: profile.id, // Assign to the matched user
                            contract_value_assessment: enrichedData.contract_value_assessment,
                            hiring_urgency: enrichedData.hiring_urgency,
                            placement_difficulty: enrichedData.placement_difficulty,
                            seniority_level: enrichedData.seniority_level,
                        })
                        .eq('id', opportunity.id);
                        assignedOppIds.add(opportunity.id);
                    }
                } catch (e) {
                    console.error(`Error scoring opportunity ${opportunity.id} for user ${profile.id}:`, e.message);
                }
            }
        }
    }

    // Second pass: Score unassigned opportunities for general market quality
    const unassignedOpportunities = opportunities.filter(opp => !assignedOppIds.has(opp.id));
    console.log(`[score-proactive-opportunities] Scoring ${unassignedOpportunities.length} unassigned opportunities for general market quality.`);

    for (const opportunity of unassignedOpportunities) {
        const generalScoringPrompt = `
            You are an AI sourcing analyst.
            Score this opportunity’s general recruitment sales value for contract seekers.
            Job: ${JSON.stringify(opportunity.job_data)}

            Return a JSON with:
            - "relevance_score"
            - "relevance_reasoning" (e.g., “Senior-level role at under-resourced startup with no TA team”)
        `;

        try {
            const result = await callGemini(generalScoringPrompt, GEMINI_API_KEY);
            if (result && result.relevance_score >= 7) {
                const enrichedData = await callGemini(enrichmentPromptTemplate(opportunity.job_data), GEMINI_API_KEY);
                // It's a hot market opportunity
                await supabaseAdmin
                    .from('proactive_opportunities')
                    .update({
                        relevance_score: result.relevance_score,
                        relevance_reasoning: result.relevance_reasoning,
                        status: 'reviewed',
                        user_id: null, // Explicitly unassigned
                        contract_value_assessment: enrichedData.contract_value_assessment,
                        hiring_urgency: enrichedData.hiring_urgency,
                        placement_difficulty: enrichedData.placement_difficulty,
                        seniority_level: enrichedData.seniority_level,
                    })
                    .eq('id', opportunity.id);
            } else {
                // Not a good fit for anyone, dismiss it
                await supabaseAdmin
                    .from('proactive_opportunities')
                    .update({ status: 'dismissed', relevance_reasoning: 'Did not meet quality standards for personalized or general market display.' })
                    .eq('id', opportunity.id);
            }
        } catch (e) {
            console.error(`Error doing general scoring for opportunity ${opportunity.id}:`, e.message);
            // Dismiss on error to avoid reprocessing
            await supabaseAdmin
                .from('proactive_opportunities')
                .update({ status: 'dismissed', error_message: e.message })
                .eq('id', opportunity.id);
        }
    }

    const finalMessage = `Scoring complete. Processed ${opportunities.length} opportunities.`;
    console.log(`[score-proactive-opportunities] ${finalMessage}`);
    return new Response(JSON.stringify({ message: finalMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Score Proactive Opportunities Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});