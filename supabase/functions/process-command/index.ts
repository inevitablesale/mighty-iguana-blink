// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { command } = await req.json();
    if (!command) {
      return new Response(JSON.stringify({ error: 'Command text is required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set.");
    }

    const prompt = `
      You are the intent recognition engine for a recruiter assistant app called Coogi.
      Your task is to analyze the user's command and determine their intent and any relevant entities based on your knowledge of the app.

      **App Knowledge Base:**
      - "Agents": These are AI assistants that find job opportunities. They can be "run" to start a search.
      - "Campaigns": These are outreach emails drafted for opportunities. They have a status like 'draft' or 'sent'. Users can "send" a draft campaign.
      - "Placements": These are successful hires resulting from a campaign.
      - "Proposals": These are formal contracts generated for a client.
      - "Analytics" or "Reports": This is a page with charts and metrics.

      **Possible Intents:**
      - "CREATE_AGENT": User wants to create or build a new agent.
      - "RUN_AGENT": User wants to run an existing agent. Extract the "agent_name".
      - "SEND_CAMPAIGN": User wants to send a draft outreach campaign. Extract the "company_name".
      - "NAVIGATE": User wants to go to a specific page. Extract the "page" name (e.g., campaigns, agents, placements, proposals, analytics).
      - "UNKNOWN": The user's intent is unclear or not supported.

      **User Command:** "${command}"

      **Instructions:**
      Return a single, valid JSON object with two keys:
      1. "intent": One of the possible intents listed above.
      2. "entities": An object containing any extracted information. If no entities are found, return an empty object.

      **Examples:**
      - Command: "run the fintech agent" -> { "intent": "RUN_AGENT", "entities": { "agent_name": "fintech" } }
      - Command: "go to my placements" -> { "intent": "NAVIGATE", "entities": { "page": "placements" } }
      - Command: "send the email to Globex Corp" -> { "intent": "SEND_CAMPAIGN", "entities": { "company_name": "Globex Corp" } }
    `;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
          }
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

    const parsedResponse = JSON.parse(aiResponseText);

    return new Response(JSON.stringify(parsedResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Edge Function error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});