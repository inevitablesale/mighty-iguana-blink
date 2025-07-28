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
You are an expert legal and business affairs assistant for a top-tier recruitment agency. Your task is to generate a formal, professional recruitment services proposal based on industry best practices.

The client is: ${campaign.company_name}
The role to be filled is: ${campaign.role}
The proposed fee structure is: "${feeStructure}"

Generate a JSON object with a single key: "proposalBody". The value should be a complete, well-formatted proposal document as a single string. Use markdown for formatting (e.g., # for headers, * for italics, \\n for newlines).

The proposal must include the following sections, written in clear, professional language:
1.  **Introduction**: A brief introduction of the proposal for recruitment services for the specified role.
2.  **Scope of Services**: Detail the comprehensive services the agency will provide. This must include: candidate sourcing from a global talent pool, rigorous screening and vetting, interview coordination, offer negotiation support, and background checks.
3.  **Fee Structure**: Clearly state the fee based on the provided structure: "${feeStructure}". Specify that the fee is due upon the successful candidate's official start date.
4.  **Contingency Basis**: State clearly that this is a contingency-based agreement, meaning no fee is due unless the client hires a candidate presented by the agency.
5.  **Candidate Guarantee**: Include a 90-day replacement guarantee. If the hired candidate leaves for any reason (excluding redundancy or elimination of the position) within 90 days of their start date, the agency will find a replacement candidate at no additional cost.
6.  **Confidentiality**: A standard clause ensuring that all information shared by the client and about the candidates will be kept strictly confidential.
7.  **Non-Solicitation**: A standard clause prohibiting the client from directly hiring any candidate presented by the agency for a period of 12 months without the agency's consent and payment of the agreed fee.
8.  **Acceptance**: A concluding section with a call to action and fields for the client's authorized signature, name, title, and date to formalize the agreement.

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