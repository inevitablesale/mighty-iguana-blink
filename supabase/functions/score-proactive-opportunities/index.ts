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
    console.log("[score-proactive-opportunities] Function invoked.");
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: opportunities, error: oppError } = await supabaseAdmin
      .from('proactive_opportunities')
      .select('id, job_data')
      .eq('status', 'new');

    if (oppError) throw new Error(`Failed to fetch new opportunities: ${oppError.message}`);
    
    if (!opportunities || opportunities.length === 0) {
      const message = "No new opportunities to score.";
      console.log(`[score-proactive-opportunities] Exiting cleanly: ${message}`);
      return new Response(JSON.stringify({ message }), { status: 200, headers: corsHeaders });
    }
    console.log(`[score-proactive-opportunities] Found ${opportunities.length} new opportunities to score.`);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");

    const genericRecruiterProfile = "A top-tier, generalist recruiter focused on identifying high-value, high-growth opportunities in the tech sector across North America. They are interested in roles with clear hiring signals, significant contract value, and strong company fundamentals.";
    
    let acceptedCount = 0;
    let dismissedCount = 0;
    let errorCount = 0;
    console.log(`[score-proactive-opportunities] Starting to score ${opportunities.length} opportunities against the generic profile.`);

    for (const opportunity of opportunities) {
      const scoringPrompt = `
        You are an AI-powered recruitment analyst. Your task is to score a job opportunity based on its relevance to a generic, high-performing recruiter profile.

        **Generic Recruiter Profile:**
        "${genericRecruiterProfile}"

        **Job Opportunity:**
        ${JSON.stringify(opportunity.job_data, null, 2)}

        **Instructions:**
        1.  Analyze the job opportunity carefully.
        2.  Compare it against the generic recruiter's profile.
        3.  Return a JSON object with "relevance_score" (an integer 1-10) and "relevance_reasoning" (a concise explanation for your score).
        4.  If the job is a good fit (a high-value role in the tech sector), the score should be high.
        5.  If the job is NOT a good fit (e.g., low-paying, non-tech, outside North America), you MUST assign a score of 4 or less and provide a reason in "relevance_reasoning".

        Return ONLY a single, valid JSON object with both "relevance_score" and "relevance_reasoning" keys.
      `;

      try {
        const result = await callGemini(scoringPrompt, GEMINI_API_KEY);

        if (result && result.relevance_score >= 5) {
          const { error: updateError } = await supabaseAdmin
            .from('proactive_opportunities')
            .update({
              relevance_score: result.relevance_score,
              relevance_reasoning: result.relevance_reasoning,
              status: 'reviewed'
            })
            .eq('id', opportunity.id);

          if (updateError) {
            console.error(`Failed to update opportunity ${opportunity.id}:`, updateError.message);
            errorCount++;
          } else {
            acceptedCount++;
          }
        } else {
          // No good match found, mark as dismissed but still save the reasoning
          const { error: updateError } = await supabaseAdmin
            .from('proactive_opportunities')
            .update({
              status: 'dismissed',
              relevance_score: result?.relevance_score || 0,
              relevance_reasoning: result?.relevance_reasoning || "AI evaluation resulted in a low score."
            })
            .eq('id', opportunity.id);
          
          if (updateError) {
            console.error(`Failed to update dismissed opportunity ${opportunity.id}:`, updateError.message);
            errorCount++;
          } else {
            dismissedCount++;
          }
        }
      } catch (e) {
        console.error(`Error scoring opportunity ${opportunity.id}:`, e.message);
        await supabaseAdmin.from('proactive_opportunities').update({ status: 'error', relevance_reasoning: e.message }).eq('id', opportunity.id);
        errorCount++;
      }
    }

    const finalMessage = `Scoring complete. Accepted: ${acceptedCount}, Dismissed: ${dismissedCount}, Errored: ${errorCount}. Total reviewed: ${opportunities.length}.`;
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