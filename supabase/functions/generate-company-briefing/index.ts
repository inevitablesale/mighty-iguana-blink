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
You are an AI research analyst. Your task is to generate a concise, factual briefing for a fictional company called "${companyName}".
The briefing should be structured for a recruiter to quickly understand the company and its potential hiring needs.

Generate a JSON object with the following keys. Do not include any other text, explanations, or markdown.
- "overview": A one-paragraph summary of what the company does.
- "recentNews": A bulleted list (as a single string with '\\n- ' separators) of 2-3 recent, significant (but fictional) news items or milestones (e.g., funding, product launch, key hire).
- "keyPersonnel": A bulleted list (as a single string with '\\n- ' separators) of 2-3 key executives (fictional names and titles, e.g., 'Jane Doe - CEO & Founder').
- "techStack": A comma-separated string of plausible technologies the company might use.
- "hiringAnalysis": A brief, one-paragraph analysis of their likely hiring needs based on the information provided.

Example Output:
{
  "overview": "Innovatech Solutions is a B2B SaaS company that provides AI-powered logistics and supply chain management software. They help businesses optimize their delivery routes, manage inventory, and reduce transportation costs.",
  "recentNews": "- Just closed a $40M Series B funding round led by Venture Partners.\\n- Launched a new predictive analytics module for demand forecasting.\\n- Announced expansion into the European market, opening a new office in Berlin.",
  "keyPersonnel": "- Alex Chen - CEO & Co-Founder\\n- Brenda Matthews - CTO\\n- Carlos Rodriguez - VP of Sales",
  "techStack": "React, Node.js, Python, PostgreSQL, AWS, Docker, Kubernetes",
  "hiringAnalysis": "Given their recent Series B funding and European expansion, Innovatech is likely to be hiring aggressively for sales and marketing roles in the EU. The new analytics module suggests a need for more Data Scientists and ML Engineers. They will also likely need to scale their core engineering and DevOps teams to support this growth."
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