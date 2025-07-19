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
    const { opportunity, recruiterSpecialty, recruiterFirstName, calendlyUrl } = await req.json();

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
You are an expert business development copywriter for a top-tier recruiter.
Your task is to write a concise, compelling, and personalized cold email.

The recruiter's name is ${recruiterFirstName || 'your partner at Coogi'}.
The recruiter's specialties are: "${recruiterSpecialty || 'general recruiting'}".
The opportunity details are:
- Company: ${opportunity.companyName}
- Role: ${opportunity.role}
- Key Signal: "${opportunity.keySignal}"

The recruiter's Calendly link for booking a meeting is: ${calendlyUrl || '(not provided)'}

Guidelines for the email:
- The tone should be professional, helpful, and low-pressure.
- The email should be concise (2-3 short paragraphs).
- Start with a personalized hook that references the Key Signal or the company's hiring.
- Briefly introduce the recruiter's value proposition, aligning with their specialty.
- End with a clear, low-friction call to action. If a Calendly link is provided, include it.
- Do NOT use placeholders like "[Hiring Manager Name]". The message should be ready to send.

Return a JSON object with two keys: "subject" and "body". The body should be a single string with \\n for newlines.

Example Output:
{
  "subject": "Re: Top-tier talent for your ${opportunity.role} team",
  "body": "Hi there,\\n\\nI saw that ${opportunity.companyName} is scaling its ${opportunity.role} team, and given the recent news about your ${opportunity.keySignal}, I imagine finding top-tier talent is a key priority.\\n\\nAs a specialist in this area, I have a network of passive talent that could be a great fit and help you hit your hiring targets faster.\\n\\nIf you're open to a brief chat, feel free to book a time on my calendar: ${calendlyUrl}\\n\\nBest,\\n${recruiterFirstName || 'Partner at Coogi'}"
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