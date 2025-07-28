// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function callApifyActor(input, token) {
    const actorId = 'data_xplorer~google-news-scraper';
    const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(120000) // 2 minute timeout
    });
    if (!response.ok) {
        throw new Error(`Apify actor ${actorId} failed: ${await response.text()}`);
    }
    return await response.json();
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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyName } = await req.json();
    if (!companyName) throw new Error("Company name is required.");

    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!APIFY_API_TOKEN || !GEMINI_API_KEY) {
      throw new Error("Required API keys (Apify or Gemini) are not set.");
    }

    const apifyInput = {
        "keywords": [companyName],
        "maxArticles": 10,
        "timeframe": "7d",
        "region_language": "US:en",
        "proxyConfiguration": { "useApifyProxy": true }
    };

    const newsArticles = await callApifyActor(apifyInput, APIFY_API_TOKEN);

    if (!newsArticles || newsArticles.length === 0) {
      return new Response(JSON.stringify({ 
        analysis: { 
          summary: "No recent news found for this company in the last 7 days.", 
          signals: [], 
          risks: [],
          articles: []
        } 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    
    const articlesForPrompt = newsArticles.map(a => ({ title: a.title, source: a.source, url: a.url })).slice(0, 10);

    const analysisPrompt = `
      You are a senior business analyst. You have been provided with a list of recent news articles about the company "${companyName}".
      Your task is to analyze these articles and provide actionable insights for a recruiter.

      News Articles:
      ${JSON.stringify(articlesForPrompt)}

      Instructions:
      1. Read through the headlines and sources.
      2. Synthesize the information to identify key themes and events.
      3. Extract specific, actionable "buying signals" or "outreach triggers". These are positive events that suggest the company is growing and likely hiring (e.g., "Announced $50M Series B funding", "Launched new AI-powered product line", "Appointed new VP of Sales", "Expanding operations to Europe").
      4. Extract specific "risks" or "negative signals". These are events that might suggest caution (e.g., "Announced layoffs in the engineering department", "Facing regulatory scrutiny over data privacy", "Reported lower-than-expected quarterly earnings").
      5. Provide a concise overall summary of the recent news.

      Return a single, valid JSON object with the following keys:
      - "summary": A one-paragraph summary of your analysis.
      - "signals": An array of strings, where each string is a positive buying signal.
      - "risks": An array of strings, where each string is a negative signal or risk.

      If no significant signals or risks are found, return empty arrays for those keys.
    `;

    const analysisResult = await callGemini(analysisPrompt, GEMINI_API_KEY);
    
    const finalAnalysis = {
      ...analysisResult,
      articles: articlesForPrompt
    };

    return new Response(JSON.stringify({ analysis: finalAnalysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Analyze Company News error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});