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
    const { userId } = await req.json();
    if (!userId) throw new Error("User ID is required.");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: agents, error: agentsError } = await supabaseAdmin
      .from('agents')
      .select('prompt')
      .eq('user_id', userId);

    if (agentsError) throw new Error(`Failed to fetch agents: ${agentsError.message}`);
    if (!agents || agents.length === 0) {
      await supabaseAdmin.from('profiles').update({ intent_profile: null }).eq('id', userId);
      return new Response(JSON.stringify({ message: "No agents found, intent profile cleared." }), { status: 200, headers: corsHeaders });
    }

    const agentPrompts = agents.map(a => a.prompt).join('\n- ');

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");

    const synthesisPrompt = `
      You are building a high-level intent profile for a recruiter focused on contract acquisition.
      Given this list of saved prompts:
      - ${agentPrompts}
      
      Create a JSON summary that reflects:
      - Their industry focus
      - Typical role targets
      - Ideal client company profile

      Return a single, valid JSON object with one key: "intent_profile_summary".
      Example: { "intent_profile_summary": "Helping fintech startups with no in-house recruiting hire mid-to-senior GTM leaders in the U.S." }
    `;

    const result = await callGemini(synthesisPrompt, GEMINI_API_KEY);
    const intentProfile = result.intent_profile_summary;

    if (!intentProfile) throw new Error("AI failed to generate an intent profile summary.");

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ intent_profile: { summary: intentProfile } })
      .eq('id', userId);

    if (updateError) throw new Error(`Failed to update profile: ${updateError.message}`);

    return new Response(JSON.stringify({ message: "User intent profile updated successfully." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Update Intent Profile Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});