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
    const { profile } = await req.json();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Recruiter profile is required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set.");
    }

    const prompt = `
You are an AI research assistant for a top-tier recruiter using an app called "Picture This".
Your goal is to proactively find the best 3 new client opportunities based on the recruiter's specialty.

The recruiter's profile is: "${profile}"

Your tasks:
1.  Analyze the recruiter's profile to understand their niche (e.g., industry, roles, location).
2.  Based on that niche, simulate a search for companies that are prime candidates for needing recruiting help. Consider signals like recent funding, news of expansion, high hiring velocity, or key executives posting about growth.
3.  Generate a list of 3 realistic, but fictional, company opportunities that are a strong match.
4.  For each opportunity, you MUST include:
    - "hiringUrgency" and "potential" value (High, Medium, or Low).
    - "matchScore": A score from 1-10 indicating how strong a fit this lead is for the recruiter.
    - "keySignal": The single most important reason this is a good lead (e.g., "Just raised $20M Series B", "Hiring velocity increased 50%", "Key exec just posted on LinkedIn").
5.  Return ONLY a single, valid JSON object with the following structure. Do not include any other text, explanations, or markdown.

{
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

Example Profile: "I specialize in placing Senior Software Engineers in the fintech vertical on the East Coast."
Example Output:
{
  "opportunities": [
    {
      "companyName": "FinSecure Payments",
      "role": "Senior Backend Engineer (Payments)",
      "location": "New York, NY",
      "potential": "High",
      "hiringUrgency": "High",
      "matchScore": 9,
      "keySignal": "Recent $40M Series B funding for product expansion"
    },
    {
      "companyName": "WealthWise AI",
      "role": "Senior Machine Learning Engineer",
      "location": "Boston, MA",
      "potential": "High",
      "hiringUrgency": "Medium",
      "matchScore": 8,
      "keySignal": "CTO posted on LinkedIn about scaling their AI team"
    },
    {
      "companyName": "InsurTech Innovators",
      "role": "Senior Full-Stack Engineer",
      "location": "Philadelphia, PA",
      "potential": "Medium",
      "hiringUrgency": "Medium",
      "matchScore": 7,
      "keySignal": "Company announced a new product launch in 6 months"
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