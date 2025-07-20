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
    const { campaign, feeStructure } = await req.json();

    if (!campaign || !feeStructure) {
      return new Response(JSON.stringify({ error: 'Campaign and fee structure are required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set.");
    }

    const prompt = `
You are an expert legal and business affairs assistant for a top-tier recruiter.
Your task is to generate a formal, professional recruitment services proposal.

The client is: ${campaign.company_name}
The role to be filled is: ${campaign.role}
The proposed fee structure is: "${feeStructure}"

Generate a JSON object with a single key: "proposalBody".
The value should be a complete, well-formatted proposal document as a single string. Use markdown for formatting (e.g., # for headers, * for italics, \\n for newlines).

The proposal should include the following sections:
1.  **Introduction**: Briefly introduce the proposal for recruitment services.
2.  **Scope of Services**: Detail the services the recruiter will provide (e.g., sourcing, screening, interview coordination, offer negotiation).
3.  **Fee Structure**: Clearly state the fee based on the provided structure. Explain when the fee is due (e.g., upon candidate's start date).
4.  **Exclusivity Clause**: A standard clause about the recruitment terms. Assume a contingency-based search.
5.  **Candidate Guarantee**: A standard replacement guarantee (e.g., a 90-day guarantee if the candidate leaves).
6.  **Confidentiality**: A standard confidentiality clause.
7.  **Acceptance**: A section for the client to sign and date, with a concluding sentence.

Make the language professional, clear, and legally sound, but avoid overly complex jargon.
The entire output must be a single valid JSON object.
**Crucially, ensure that any double quotes within the string values of the final JSON are properly escaped with a backslash (e.g., "some \\"quoted\\" text").**
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

    return new Response(JSON.stringify({ proposal: parsedResponse }), {
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