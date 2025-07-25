// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

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
    const { html, opportunityContext } = await req.json();
    if (!html || !opportunityContext) {
      throw new Error("HTML content and opportunity context are required.");
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY secret is not set.");

    const prompt = `
      You are an expert data extraction bot. Your task is to parse the raw HTML of a LinkedIn **company** search results page and extract key information for each company listed.

      **Context:**
      I am searching for the company "${opportunityContext.company_name}".

      **Raw HTML Snippet:**
      \`\`\`html
      ${html.substring(0, 20000)}
      \`\`\`

      **Instructions:**
      1.  Analyze the provided HTML. Identify each distinct company listed in the search results.
      2.  For each company, extract the following three pieces of information:
          - "title": The full name of the company.
          - "subtitle": The company's industry and location information.
          - "url": The absolute URL to the company's LinkedIn page.
      3.  Return a single, valid JSON object with one key: "results".
      4.  The value of "results" should be an array of objects, where each object represents a company you found.
      5.  If no companies are found, return an empty array for "results".

      **Example Output Format:**
      {
        "results": [
          {
            "title": "Acme Corporation",
            "subtitle": "Software Development · San Francisco, California",
            "url": "https://www.linkedin.com/company/acme-corporation/"
          },
          ...
        ]
      }
    `;

    const result = await callGemini(prompt, GEMINI_API_KEY);

    return new Response(JSON.stringify({ results: result.results || [] }), {
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