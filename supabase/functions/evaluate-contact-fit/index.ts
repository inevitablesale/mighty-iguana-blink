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
    const { contact, opportunityId } = await req.json();
    if (!contact || !opportunityId) {
      throw new Error("Contact and Opportunity ID are required.");
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
      .select('role, company_name, agents(prompt)')
      .eq('id', opportunityId)
      .eq('user_id', user.id)
      .single();

    if (oppError || !opportunity?.agents?.prompt) {
      throw new Error("Could not find opportunity or its associated playbook prompt.");
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set.");
    }

    const prompt = `
      You are an AI recruitment assistant. Evaluate how well the following person fits the recruiter's specialty for a specific role.

      Recruiter's Specialty (Evaluation Criteria): "${opportunity.agents.prompt}"
      Role to Fill: ${opportunity.role} at ${opportunity.company_name}
      Person to Evaluate:
      - Name: ${contact.name}
      - Title: ${contact.job_title}

      Based ONLY on the information provided, provide a single, valid JSON object with the following keys:
      - "score": An integer from 1 to 10 indicating how well the person's title matches the role and specialty.
      - "status": A string, which must be one of 'Good Match', 'Potential Fit', or 'Not a Match'.
      - "reasoning": A concise, one-sentence explanation for your evaluation.

      Example Response:
      {
        "score": 8,
        "status": "Good Match",
        "reasoning": "The contact's title as 'VP of Engineering' is a strong fit for the specified 'Head of Engineering' role within the tech sector."
      }
    `;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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
      throw new Error(`Gemini API error: ${await geminiResponse.text()}`);
    }
    const geminiResult = await geminiResponse.json();
    const evaluation = JSON.parse(geminiResult.candidates?.[0]?.content?.parts?.[0]?.text);

    return new Response(JSON.stringify({ evaluation }), {
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