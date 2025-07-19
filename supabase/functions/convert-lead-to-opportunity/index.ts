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
    const { lead } = await req.json();

    if (!lead || !lead.companyName || !lead.predictedRoles) {
      return new Response(JSON.stringify({ error: 'Lead data is required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set.");
    }

    const prompt = `
You are an AI assistant for a recruiter. You have been given a predictive lead about a company that might be hiring.
Your task is to flesh this lead out into a full, detailed opportunity.

The lead is for the company "${lead.companyName}".
The predicted roles they might need are: ${lead.predictedRoles.join(', ')}.

Based on this, generate a single, realistic, but fictional, opportunity.
You MUST include:
- "companyName": The company's name.
- "role": Pick the most likely primary role from the predicted roles list.
- "location": A plausible location for this company (e.g., a major tech hub).
- "hiringUrgency" and "potential": A value for each (High, Medium, or Low).
- "matchScore": A score from 1-10 indicating how strong a fit this lead is.
- "keySignal": The single most important *hypothetical* reason this is a good lead (e.g., "Just raised $20M Series B", "Hiring velocity increased 50%", "Key exec just posted on LinkedIn").

Return ONLY a single, valid JSON object representing this opportunity. Do not include any other text, explanations, or markdown.

Example output:
{
  "companyName": "QuantumLeap AI",
  "role": "Quantum ML Engineer",
  "location": "San Francisco, CA",
  "potential": "High",
  "hiringUrgency": "Medium",
  "matchScore": 9,
  "keySignal": "Launched new AI ethics division"
}
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
      console.error("Gemini API error:", errorText);
      throw new Error(`Gemini API error: ${geminiResponse.statusText} - ${errorText}`);
    }

    const geminiResult = await geminiResponse.json();
    const aiResponseText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiResponseText) {
      throw new Error("Failed to get a valid response from Gemini.");
    }

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