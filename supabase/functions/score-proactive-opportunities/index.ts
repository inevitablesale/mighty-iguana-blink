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

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, intent_profile')
      .not('intent_profile', 'is', null);

    if (profileError) throw new Error(`Failed to fetch user profiles: ${profileError.message}`);
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No users with intent profiles to score against." }), { status: 200, headers: corsHeaders });
    }

    const { data: opportunities, error: oppError } = await supabaseAdmin
      .from('proactive_opportunities')
      .select('id, job_data')
      .eq('status', 'new')
      .limit(50); // Process in batches to avoid timeouts

    if (oppError) throw new Error(`Failed to fetch new opportunities: ${oppError.message}`);
    if (!opportunities || opportunities.length === 0) {
      return new Response(JSON.stringify({ message: "No new opportunities to score." }), { status: 200, headers: corsHeaders });
    }
    
    console.log(`[score-proactive-opportunities] Found ${opportunities.length} new opportunities to score against ${profiles.length} user profiles.`);
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");

    for (const profile of profiles) {
      if (!profile.intent_profile?.summary) continue;

      for (const opportunity of opportunities) {
        const scoringPrompt = `
          You are an AI recruitment analyst. Score a job opportunity based on its relevance to a specific recruiter's profile.

          **Recruiter's Profile (Their Specialty):**
          "${profile.intent_profile.summary}"

          **Job Opportunity to Score:**
          ${JSON.stringify(opportunity.job_data, null, 2)}

          **Instructions:**
          1.  Analyze the job opportunity carefully.
          2.  Compare it against the recruiter's specific profile.
          3.  Return a JSON object with "relevance_score" (an integer 1-10) and "relevance_reasoning" (a concise explanation for your score).
          4.  A score of 7-10 means it's a strong match for this specific recruiter.
          5.  A score of 4-6 is a potential but not perfect match.
          6.  A score of 1-3 is a poor match.
          7.  Your reasoning MUST be addressed to the recruiter, explaining *why* this is a good or bad match for *them*.

          Return ONLY a single, valid JSON object.
        `;

        try {
          const result = await callGemini(scoringPrompt, GEMINI_API_KEY);
          
          if (result && result.relevance_score >= 5) {
            await supabaseAdmin
              .from('proactive_opportunities')
              .update({
                relevance_score: result.relevance_score,
                relevance_reasoning: result.relevance_reasoning,
                status: 'reviewed',
                user_id: profile.id // Assign to the matched user
              })
              .eq('id', opportunity.id);
          }
        } catch (e) {
          console.error(`Error scoring opportunity ${opportunity.id} for user ${profile.id}:`, e.message);
        }
      }
    }
    
    // Mark any remaining 'new' opportunities as 'dismissed' if they didn't match anyone
    const oppIds = opportunities.map(o => o.id);
    await supabaseAdmin
      .from('proactive_opportunities')
      .update({ status: 'dismissed', relevance_reasoning: 'Did not match any active user profiles.' })
      .in('id', oppIds)
      .eq('status', 'new');

    const finalMessage = `Scoring complete. Processed ${opportunities.length} opportunities against ${profiles.length} user profiles.`;
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