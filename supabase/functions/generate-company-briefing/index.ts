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
You are an AI research analyst. Your task is to generate a concise, factual briefing for the company: "${companyName}".
Your primary goal is accuracy and reliability. Do not invent or embellish information.

**Instructions:**
1.  **Perform a targeted search for information about the company, focusing on the last 6 months.**
2.  Generate a JSON object with the keys defined below.
3.  If you cannot find specific details for a section, you must explicitly state that the information is not readily available or return an empty array where appropriate.

**JSON Structure:**
- "overview": A factual summary of what the company does.
- "recentNews": An array of objects, where each object has "title" (the news headline), "source" (the publication name, e.g., 'TechCrunch'), and "date" (e.g., 'YYYY-MM-DD'). If no news is found in the last 6 months, return an empty array.
- "keyPersonnel": A bulleted list (as a single string with '\\n- ' separators) of key executives. If not found, state "Key personnel information not readily available."
- "techStack": A comma-separated string of technologies the company is known to use. If unknown, state "Tech stack not publicly specified."
- "hiringAnalysis": A brief analysis of their likely hiring needs based on the factual information gathered.

The entire output must be a single valid JSON object.
**Crucially, ensure that any double quotes within the string values of the final JSON are properly escaped with a backslash (e.g., "some \\"quoted\\" text").**
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