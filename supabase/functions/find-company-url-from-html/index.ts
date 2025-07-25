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
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");

    const prompt = `
      You are an expert web scraper. Your task is to find the correct LinkedIn company URL from a raw HTML snippet of a search results page.

      **Context:**
      I am looking for the company named: "${opportunityContext.company_name}"

      **Raw HTML Snippet (partial):**
      \`\`\`html
      ${html.substring(0, 30000)}
      \`\`\`

      **Instructions:**
      1.  First, locate the main container for the search results. This is likely a \`<div>\` or \`<ul>\` with a class name containing "search-results", "scaffold-results", or "results-list".
      2.  Within that container, look for individual list items (\`<li>\`) or divs that represent a single company.
      3.  Find the result item where the company name most closely matches "${opportunityContext.company_name}".
      4.  Once you've found the correct company's result item, extract the absolute URL from the primary \`<a>\` tag's \`href\` attribute. The correct URL will always contain "/company/".
      5.  Return a single, valid JSON object with one key: "url".
      6.  If you cannot find a definitive match, return null for the "url" value.

      **Example Output:**
      {
        "url": "https://www.linkedin.com/company/the-correct-company/"
      }
    `;

    const result = await callGemini(prompt, GEMINI_API_KEY);

    return new Response(JSON.stringify({ url: result.url || null }), {
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