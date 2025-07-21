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
      You are the conversational AI engine for a recruiter assistant app called Coogi.
      Your task is to analyze the user's command, determine their intent, and generate a natural, conversational response for the AI to speak.

      **App Knowledge Base:**
      - The main page is the "Command Center" (route: "/"), which shows new "opportunities".
      - "Agents": AI assistants that find job opportunities. They can be "run".
      - "Campaigns": Outreach emails. They can be "sent".
      - "Placements", "Proposals", "Analytics": Pages the user can navigate to.

      **Possible Intents:**
      - "CREATE_AGENT", "RUN_AGENT", "SEND_CAMPAIGN", "NAVIGATE", "UNKNOWN"

      **User Command:** "${command}"

      **Instructions:**
      Return a single, valid JSON object with three keys:
      1. "intent": One of the possible intents.
      2. "entities": An object with any extracted info (e.g., "agent_name", "company_name", "page"). For navigation, valid pages are "home", "campaigns", "agents", "placements", "proposals", "analytics". "home" refers to the main Command Center.
      3. "responseText": A friendly, conversational sentence for the AI to say back to the user.

      **Examples:**
      - Command: "run the fintech agent" -> { "intent": "RUN_AGENT", "entities": { "agent_name": "fintech" }, "responseText": "Sure, I'm running the fintech agent for you now. I'll let you know when it's done." }
      - Command: "go to my placements" -> { "intent": "NAVIGATE", "entities": { "page": "placements" }, "responseText": "Of course, heading over to the Placements page now." }
      - Command: "show me my opportunities" -> { "intent": "NAVIGATE", "entities": { "page": "home" }, "responseText": "Right, I'll take you to the Command Center to see your latest opportunities." }
      - Command: "send the email to Globex Corp" -> { "intent": "SEND_CAMPAIGN", "entities": { "company_name": "Globex Corp" }, "responseText": "You got it. Sending the campaign to Globex Corp." }
      - Command: "make me a new agent" -> { "intent": "CREATE_AGENT", "entities": {}, "responseText": "No problem, I'll bring up the form to create a new agent." }
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