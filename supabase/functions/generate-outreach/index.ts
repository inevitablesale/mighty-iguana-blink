/// <reference no-default-lib="true" />
/// <reference lib="deno.ns" />
/// <reference lib="esnext" />

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
You are an expert business development copywriter for a top-tier recruiter. Your task is to write a concise, compelling, and personalized outreach email to a potential new client.

The recruiter is using an app called "Picture This".
The target company is: ${opportunity.companyName}
The role they might need help with is: ${opportunity.role}
The key signal that they might be hiring is: "${opportunity.keySignal}"

Based on this information, generate a JSON object with two keys: "subject" and "body".

Guidelines for the email body:
- Keep it short and professional (under 150 words).
- Start with a personalized hook that references the key signal.
- Briefly introduce the value proposition (a recruiter with a strong network).
- End with a clear, low-friction call to action (e.g., asking if they are open to exploring a partnership).
- Do NOT use placeholders like "[Your Name]". Sign off as "A Partner at Picture This".

Example Output Structure:
{
  "subject": "Your next hire at ${opportunity.companyName}",
  "body": "Hi [Hiring Manager Name],\\n\\nI saw that ${opportunity.companyName} ${opportunity.keySignal}. Given this momentum, I imagine finding top-tier talent for the ${opportunity.role} position is a priority.\\n\\nI specialize in placing high-performing candidates in this space and have a network of passive talent that could be a great fit.\\n\\nWould you be open to a brief chat next week to discuss how I can help you scale your team?\\n\\nBest,\\nA Partner at Picture This"
}

Generate a new, unique email based on the provided opportunity.
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
    
    // Combine the opportunity data with the generated draft
    const finalResponse = {
      ...opportunity,
      draft: parsedResponse,
    };

    return new Response(JSON.stringify(finalResponse), {
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