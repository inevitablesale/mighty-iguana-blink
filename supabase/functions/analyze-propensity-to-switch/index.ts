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
      You are a contract sales strategist.
      Assess how urgently this company needs external help to fill the role.

      Input: {
        "company": "${opportunity.company_name}",
        "role": "${opportunity.role}",
        "location": "${opportunity.location}",
        "overview": "${opportunity.company_overview}",
        "pain_points": "${opportunity.pain_points}"
      }

      Return a single, valid JSON object with the following keys:
      - "score": An integer from 1 to 10 indicating the urgency and need for external help.
      - "positive_signals": An array of strings listing factors that suggest high urgency (e.g., role reposted, recent layoffs, company expansion, high churn).
      - "negative_signals": An array of strings listing factors that suggest low urgency (e.g., strong internal TA team, niche skill easily sourced).
      - "summary": A concise paragraph explaining why this company is or isn't ready for recruiter outreach.
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