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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: opportunities, error: oppError } = await supabaseAdmin
      .from('proactive_opportunities')
      .select('id, job_data')
      .eq('status', 'new')
      .limit(20); // Process in batches

    if (oppError) throw new Error(`Failed to fetch new opportunities: ${oppError.message}`);
    if (!opportunities || opportunities.length === 0) {
      return new Response(JSON.stringify({ message: "No new opportunities to score." }), { status: 200, headers: corsHeaders });
    }

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, intent_profile')
      .not('intent_profile', 'is', null);

    if (profileError) throw new Error(`Failed to fetch user profiles: ${profileError.message}`);
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No user profiles with intent found to score against." }), { status: 200, headers: corsHeaders });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");

    let scoredCount = 0;

    for (const opportunity of opportunities) {
      const profilesForPrompt = profiles.map(p => ({ userId: p.id, profile: p.intent_profile.summary }));

      const scoringPrompt = `
        You are an AI-powered recruitment matchmaker. Your task is to find the single best recruiter for a given job opportunity from a list of recruiter profiles.

        **Job Opportunity:**
        ${JSON.stringify(opportunity.job_data, null, 2)}

        **Recruiter Profiles:**
        ${JSON.stringify(profilesForPrompt, null, 2)}

        **Instructions:**
        1.  Analyze the job opportunity carefully.
        2.  Compare it against each recruiter's profile.
        3.  Identify the single BEST match. The best match is a recruiter who would see this as a high-value, must-win opportunity, even if it's slightly outside their explicit focus.
        4.  If you find a good match, return a JSON object with "userId", "relevance_score" (an integer 1-10), and "relevance_reasoning" (a concise explanation of why it's a great match).
        5.  If NO recruiter is a good fit (i.e., the best possible score would be 4 or less), you MUST return a JSON object with "userId": null.

        Return ONLY a single, valid JSON object.
      `;

      try {
        const result = await callGemini(scoringPrompt, GEMINI_API_KEY);

        if (result && result.userId && result.relevance_score >= 5) {
          const { error: updateError } = await supabaseAdmin
            .from('proactive_opportunities')
            .update({
              user_id: result.userId,
              relevance_score: result.relevance_score,
              relevance_reasoning: result.relevance_reasoning,
              status: 'reviewed'
            })
            .eq('id', opportunity.id);

          if (updateError) {
            console.error(`Failed to update opportunity ${opportunity.id}:`, updateError.message);
          } else {
            scoredCount++;
          }
        } else {
          // No good match found, mark as dismissed to avoid re-processing
          await supabaseAdmin.from('proactive_opportunities').update({ status: 'dismissed' }).eq('id', opportunity.id);
        }
      } catch (e) {
        console.error(`Error scoring opportunity ${opportunity.id}:`, e.message);
        // Mark as errored to avoid retrying a failing prompt
        await supabaseAdmin.from('proactive_opportunities').update({ status: 'error', relevance_reasoning: e.message }).eq('id', opportunity.id);
      }
    }

    return new Response(JSON.stringify({ message: `Scoring complete. Matched ${scoredCount} opportunities to users.` }), {
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