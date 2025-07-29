// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function callGemini(prompt, apiKey, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
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

      if (geminiResponse.status === 503) {
        if (i < retries - 1) {
          console.warn(`Gemini API returned 503. Retrying in ${delay / 1000}s... (${i + 1}/${retries})`);
          await new Promise(res => setTimeout(res, delay));
          delay *= 2; // Exponential backoff
          continue;
        } else {
          throw new Error(`Gemini API error: The model is overloaded. Please try again later. (Status: 503)`);
        }
      }

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
    } catch (error) {
      if (i === retries - 1) throw error;
    }
  }
  throw new Error("Gemini API call failed after multiple retries.");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { opportunityId, contact, isAutomatic } = await req.json();
    if (!opportunityId || !contact) throw new Error("Opportunity ID and Contact are required.");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const userRes = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
    if (userRes.error) throw new Error("Authentication failed");
    const user = userRes.data.user;

    const { data: opportunity, error: oppError } = await supabaseAdmin
      .from('opportunities')
      .select('*, agents(prompt)')
      .eq('id', opportunityId)
      .eq('user_id', user.id)
      .single();

    if (oppError) throw new Error(`Failed to fetch opportunity: ${oppError.message}`);
    if (!opportunity.agents) throw new Error("Opportunity is not linked to a valid agent.");

    const { data: profile } = await supabaseAdmin.from('profiles').select('first_name, calendly_url').eq('id', user.id).single();

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");

    const outreachPrompt = `
      You are a world-class BD copywriter for recruiters.
      Write a personalized cold email pitch to secure a staffing contract.

      Inputs:
      - Recipient: { "name": "${contact.name}", "title": "${contact.job_title}" }
      - Recruiter Profile: { "name": "${profile?.first_name || 'your partner at Coogi'}", "niche": "${opportunity.agents.prompt}", "angle": "${opportunity.recruiter_angle}" }
      - Client Opportunity: { "company": "${opportunity.company_name}", "role": "${opportunity.role}", "pain_points": "${opportunity.pain_points}", "key_signal": "${opportunity.key_signal_for_outreach}" }

      Write a 2-paragraph email that:
      1. Uses the Key Signal as the opener (“Saw this role reposted”)
      2. Offers immediate help (“We specialize in this exact need…”)
      3. Ends with a low-friction CTA (e.g., “Want me to send a few candidates?”)

      Return as JSON: { "subject": "...", "body": "..." }
    `;

    const outreachResult = await callGemini(outreachPrompt, GEMINI_API_KEY);

    const campaignStatus = isAutomatic ? 'contacted' : 'draft';

    const { data: newCampaign, error: insertError } = await supabaseAdmin.from('campaigns').insert({
      user_id: user.id,
      opportunity_id: opportunity.id,
      company_name: opportunity.company_name,
      role: opportunity.role,
      subject: outreachResult.subject,
      body: outreachResult.body,
      status: campaignStatus,
      contact_name: contact.name,
      contact_email: contact.email,
    }).select().single();

    if (insertError) throw new Error(`Failed to save campaign: ${insertError.message}`);

    const successMessage = isAutomatic 
      ? "Outreach automatically generated and sent."
      : "Outreach draft created successfully.";

    return new Response(JSON.stringify({ message: successMessage, campaign: newCampaign }), {
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