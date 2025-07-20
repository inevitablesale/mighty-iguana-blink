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
    const { companyName } = await req.json();

    if (!companyName) {
      return new Response(JSON.stringify({ error: 'Company name is required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set.");
    }

    const prompt = `
You are an AI research analyst with access to a vast knowledge base of public information about real-world companies.
Your task is to generate a concise, factual briefing for the company: "${companyName}".

**Crucially, do not invent, embellish, or fictionalize any information.** Your primary goal is accuracy and reliability. If you cannot find specific details for a section (e.g., recent news or key personnel), you must explicitly state that the information is not readily available, rather than creating something.

Generate a JSON object with the following keys:
- "overview": A factual summary of what the company does.
- "recentNews": A bulleted list (as a single string with '\\n- ' separators) of recent, significant news items or milestones. If none are found, state "No recent significant news found."
- "keyPersonnel": A bulleted list (as a single string with '\\n- ' separators) of key executives. If not found, state "Key personnel information not readily available."
- "techStack": A comma-separated string of technologies the company is known to use, based on public data like job postings or tech blogs. If unknown, state "Tech stack not publicly specified."
- "hiringAnalysis": A brief analysis of their likely hiring needs based *only* on the factual information you have gathered.

The entire output must be a single valid JSON object.
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

    return new Response(JSON.stringify({ briefing: parsedResponse }), {
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