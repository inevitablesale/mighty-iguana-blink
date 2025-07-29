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
  if (!aiResponseText) return null;
  
  try {
    return JSON.parse(aiResponseText);
  } catch (e) {
    console.error("Failed to parse Gemini JSON response for domain:", aiResponseText);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyName } = await req.json();
    if (!companyName) {
      throw new Error("Company name is required.");
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set.");
    }

    const findUrlPrompt = `What is the official website URL for the company "${companyName}"? Return a single valid JSON object with one key: "websiteUrl". If you cannot find it, return null.`;
    const urlResult = await callGemini(findUrlPrompt, GEMINI_API_KEY);
    const websiteUrl = urlResult?.websiteUrl;

    if (!websiteUrl) {
      return new Response(JSON.stringify({ domain: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const domain = new URL(websiteUrl).hostname.replace(/^www\./, '');

    return new Response(JSON.stringify({ domain }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Get Company Domain error:", error.message);
    // Return null domain on error to not break the calling function
    return new Response(JSON.stringify({ domain: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});