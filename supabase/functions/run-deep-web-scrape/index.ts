// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { companyName } = await req.json();
    if (!companyName) throw new Error("Company name is required.");

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");
    
    // Step 1: Find company website URL using Gemini
    const findUrlPrompt = `What is the official website URL for the company "${companyName}"? Return a single valid JSON object with one key: "websiteUrl". If you cannot find it, return null.`;
    const urlResult = await callGemini(findUrlPrompt, GEMINI_API_KEY);
    const websiteUrl = urlResult.websiteUrl;

    if (!websiteUrl) {
      throw new Error(`Could not find a website for "${companyName}".`);
    }

    // Step 2: Call the Apify Deep Web Scraper actor
    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN secret is not set.");

    const apifyApiUrl = `https://api.apify.com/v2/acts/peterasorensen~snacci/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`;
    
    const apifyInput = {
      "websites": [websiteUrl],
      "scrapeTypes": ["emails", "phoneNumbers", "socialMedia"],
      "proxyConfiguration": { "useApifyProxy": true },
      "removeDuplicates": true,
      "maxDepth": 1, // Keep it shallow to be fast
      "maxLinksPerPage": 50
    };

    const apifyResponse = await fetch(apifyApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apifyInput),
      signal: AbortSignal.timeout(120000) // 2 minute timeout
    });

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      throw new Error(`Apify API error: ${apifyResponse.statusText} - ${errorText}`);
    }

    const results = await apifyResponse.json();

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Deep Web Scrape error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})