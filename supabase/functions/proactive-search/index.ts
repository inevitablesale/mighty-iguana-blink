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
    const { agentPrompts } = await req.json();

    if (!agentPrompts || !Array.isArray(agentPrompts) || agentPrompts.length === 0) {
      return new Response(JSON.stringify({ error: 'Agent prompts are required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set.");
    }

    const prompt = `
You are an AI assistant for a recruiter. Based on the following recruiter agent specialties, generate a list of 3 realistic, but fictional, company opportunities that are not based on public job postings, but on predictive signals.

Agent Specialties:
- ${agentPrompts.join('\n- ')}

For each opportunity, you MUST include:
- "companyName": Fictional Company Name
- "signalType": The type of signal ('funding', 'expansion', 'hiring_trend').
- "signalStrength": A score from 1-10 indicating the strength of the signal.
- "predictedRoles": An array of 2-3 job roles the company is likely to need soon.

Return ONLY a single, valid JSON object with a key "leads" containing an array of these opportunities. Do not include any other text, explanations, or markdown.

Example output:
{
  "leads": [
    {
      "companyName": "QuantumLeap AI",
      "signalType": "funding",
      "signalStrength": 9,
      "predictedRoles": ["AI Ethicist", "Quantum ML Engineer"]
    },
    {
      "companyName": "BioSynth Innovations",
      "signalType": "expansion",
      "signalStrength": 7,
      "predictedRoles": ["Bioinformatics Scientist", "Lab Automation Engineer"]
    }
  ]
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

    const geminiResult = await geminiResponse.json() as { candidates?: { content?: { parts?: { text: string }[] } }[] };
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