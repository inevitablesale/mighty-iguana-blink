// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
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
    const { opportunityId } = await req.json();
    if (!opportunityId) {
      throw new Error("Opportunity ID is required.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const userRes = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
    if (userRes.error) throw new Error("Authentication failed");
    const user = userRes.data.user;

    const { data: opportunity, error: oppError } = await supabaseAdmin
      .from('opportunities')
      .select('company_name, role, location, company_overview, pain_points')
      .eq('id', opportunityId)
      .eq('user_id', user.id)
      .single();

    if (oppError) {
      throw new Error(`Failed to fetch opportunity: ${oppError.message}`);
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set.");
    }

    const prompt = `
      You are an expert talent market analyst. Your task is to assess the "propensity to switch" for the team or hiring manager related to this job opportunity, and the overall urgency of the hire.

      Opportunity Details:
      - Company: ${opportunity.company_name}
      - Role: ${opportunity.role}
      - Location: ${opportunity.location}
      - AI-Generated Company Overview: "${opportunity.company_overview}"
      - AI-Generated Pain Points: "${opportunity.pain_points}"

      Instructions:
      Analyze the provided data to identify signals that suggest the company is highly motivated to fill this role quickly. Consider factors like:
      - Is this a backfill for a recent departure?
      - Is it a new role due to expansion (check the overview for growth signals)?
      - Do the pain points suggest a critical business need?
      - Are there any public signals (you'll have to infer these) like recent funding rounds, product launches, or stock performance that would increase hiring pressure?

      Return a single, valid JSON object with the following keys:
      - "score": An integer from 1 to 10 indicating the likelihood that the hiring team is motivated and will engage with a recruiter. 10 is most likely.
      - "positive_signals": An array of strings listing the factors that INCREASE the score.
      - "negative_signals": An array of strings listing the factors that DECREASE the score (or suggest it's a standard, non-urgent hire).
      - "summary": A one-paragraph summary of your analysis.

      Ensure the entire output is a single valid JSON object.
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
      throw new Error(`Gemini API error: ${geminiResponse.statusText} - ${errorText}`);
    }

    const geminiResult = await geminiResponse.json();
    const aiResponseText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiResponseText) {
      throw new Error("Failed to get a valid response from Gemini.");
    }

    const analysis = JSON.parse(aiResponseText);

    return new Response(JSON.stringify({ analysis }), {
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