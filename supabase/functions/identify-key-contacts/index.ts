// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { contacts, opportunityContext } = await req.json();
    if (!contacts || !opportunityContext) {
      throw new Error("Contact list and opportunity context are required.");
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY secret is not set.");

    const prompt = `
      You are an expert recruitment researcher. Your task is to analyze a list of scraped employee profiles and identify the most relevant people to contact for a specific job opportunity.

      **Opportunity Context:**
      - Company: "${opportunityContext.company_name}"
      - Role we are trying to fill: "${opportunityContext.role}"
      - Location: "${opportunityContext.location}"

      **Scraped Employee Profiles:**
      ${JSON.stringify(contacts, null, 2)}

      **Instructions:**
      1.  Review the list of employees.
      2.  Identify the top 1-3 individuals who are most likely to be the hiring manager or a key decision-maker for this role. Prioritize titles like 'Head of Talent', 'Talent Acquisition Manager', 'Recruiting Manager', or the direct manager for the role's department (e.g., 'Director of Engineering' for an engineering role).
      3.  Return a single, valid JSON object with one key: "recommended_contacts".
      4.  The value of "recommended_contacts" should be an array containing the full, original objects of the employees you selected from the provided list. Do not add or change any fields. If you find no suitable contacts, return an empty array.
      **Crucially, ensure that any double quotes within the string values of the final JSON are properly escaped with a backslash (e.g., "some \\"quoted\\" text").**
    `;

    const result = await callGemini(prompt, GEMINI_API_KEY);

    return new Response(JSON.stringify({ recommended_contacts: result.recommended_contacts || [] }), {
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