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
    const { command: userCommand } = await req.json();

    if (!userCommand) {
      return new Response(JSON.stringify({ error: 'Command is required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set.");
    }

    const prompt = `
You are an AI assistant for a recruiter using an app called "Picture This". Your goal is to find new clients (companies) for the recruiter.
The user's command is: "${userCommand}".

Your tasks:
1. Parse the user's command to identify the search criteria for new recruiting contracts.
2. Generate a list of 3 realistic, but fictional, company opportunities that match these criteria.
3. For each opportunity, you MUST include:
    - "hiringUrgency" and "potential" value (High, Medium, or Low).
    - "matchScore": A score from 1-10 indicating how strong a fit this lead is for the recruiter.
    - "keySignal": The single most important reason this is a good lead (e.g., "Just raised $20M Series B", "Hiring velocity increased 50%", "Key exec just posted on LinkedIn").
4. Return ONLY a single, valid JSON object with the following structure. Do not include any other text, explanations, or markdown.

{
  "searchCriteria": {
    "role": "The job title or role to search for",
    "location": "The city, state, or region",
    "quantity": "The number of opportunities requested",
    "vertical": "The industry or vertical",
    "keywords": ["An array of other keywords"]
  },
  "opportunities": [
    {
      "companyName": "Fictional Company Name",
      "role": "The specific role they are hiring for",
      "location": "Company's location",
      "potential": "High",
      "hiringUrgency": "Medium",
      "matchScore": 9,
      "keySignal": "Just raised $20M Series B"
    }
  ]
}

If a field in "searchCriteria" is not mentioned, set it to null.

Example command: "Find me contracts for senior software engineers in Texas"
Example output:
{
  "searchCriteria": {
    "role": "senior software engineer",
    "location": "Texas",
    "quantity": null,
    "vertical": "tech",
    "keywords": []
  },
  "opportunities": [
    {
      "companyName": "Innovatech Solutions",
      "role": "Senior Backend Engineer",
      "location": "Austin, TX",
      "potential": "High",
      "hiringUrgency": "High",
      "matchScore": 9,
      "keySignal": "Hiring velocity increased 30%"
    },
    {
      "companyName": "DataDriven Inc.",
      "role": "Senior Software Engineer (AI/ML)",
      "location": "Dallas, TX",
      "potential": "High",
      "hiringUrgency": "Medium",
      "matchScore": 8,
      "keySignal": "Recent $50M Series C funding"
    },
    {
      "companyName": "CyberSecure Corp",
      "role": "Senior Security Engineer",
      "location": "Houston, TX",
      "potential": "Medium",
      "hiringUrgency": "Low",
      "matchScore": 7,
      "keySignal": "Leadership mentioned team expansion"
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