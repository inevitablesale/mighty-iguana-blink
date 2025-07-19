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
    const { opportunity } = await req.json();

    if (!opportunity) {
      return new Response(JSON.stringify({ error: 'Opportunity data is required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set.");
    }

    const prompt = `
You are an AI sourcing specialist for a recruiter. Your task is to find 5 fictional, but realistic, candidates for a specific job opportunity.

The opportunity is for the role of "${opportunity.role}" at "${opportunity.companyName}" located in "${opportunity.location}".

Your tasks:
1.  Generate a list of 5 high-quality, fictional candidates who would be a good fit for this role.
2.  For each candidate, you MUST provide:
    - "name": A realistic full name.
    - "email": A fictional but plausible email address.
    - "linkedin_url": A fictional LinkedIn profile URL.
    - "resume_summary": A 2-3 sentence summary of their skills and experience that makes them a good fit for the role.
    - "match_score": A score from 10 to 100, representing how well they match the job description.
3.  Return ONLY a single, valid JSON object with a "candidates" key. Do not include any other text, explanations, or markdown.

Example Output Structure:
{
  "candidates": [
    {
      "name": "Jane Doe",
      "email": "jane.doe@email.com",
      "linkedin_url": "https://linkedin.com/in/janedoe-example",
      "resume_summary": "Senior Software Engineer with 8 years of experience in building scalable backend systems using Java and Spring Boot. Proven track record of leading projects in the fintech space and mentoring junior developers.",
      "match_score": 95
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