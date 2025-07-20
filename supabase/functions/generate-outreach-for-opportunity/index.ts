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
    if (!opportunityId) throw new Error("Opportunity ID is required.");

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
      You are an expert business development copywriter and researcher for a top-tier recruiter.
      Your task is to write a concise, compelling, cold email and identify the likely recipient.

      **Recruiter Profile:**
      - Name: ${profile?.first_name || 'your partner at Coogi'}
      - Specialties: "${opportunity.agents.prompt}"
      - Recommended Angle: "${opportunity.recruiter_angle}"

      **Client Opportunity:**
      - Company: ${opportunity.company_name}
      - Role: ${opportunity.role}
      - Key Signal for Outreach: "${opportunity.key_signal_for_outreach}"
      - Client's Likely Pain Points: "${opportunity.pain_points}"

      **Contact Info:**
      - Calendly Link: ${profile?.calendly_url || '(not provided)'}

      **Instructions:**
      1.  **Identify Contact:** Based on the role, determine the most plausible job title for the decision-maker (e.g., "Head of Talent", "VP of Engineering").
      2.  **Guess Email:** Generate a best-guess email address for this contact. Use common patterns like "firstname.lastname@company.com" or "firstinitial.lastname@company.com". Infer the domain from the company name.
      3.  **Write Email:** Write a professional, concise email (2-3 short paragraphs).
      4.  **Hook:** Use the "Key Signal for Outreach" as your opening hook.
      5.  **Address Pain:** Subtly address the "Client's Likely Pain Points".
      6.  **Positioning:** Incorporate the "Recommended Recruiter Angle".
      7.  **CTA:** Include a clear call to action to book a meeting using the Calendly link.
      8.  **No Placeholders:** Do NOT use placeholders like "[Your Name]".

      Return a JSON object with four keys: "subject", "body", "contact_name" (the plausible job title), and "contact_email" (the best-guess email).
      **Crucially, ensure that any double quotes within the string values of the final JSON are properly escaped with a backslash (e.g., "some \\"quoted\\" text").**
    `;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: outreachPrompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        }),
      }
    );

    if (!geminiResponse.ok) throw new Error(`Gemini API error: ${await geminiResponse.text()}`);
    const geminiResult = await geminiResponse.json();
    const outreachResult = JSON.parse(geminiResult.candidates?.[0]?.content?.parts?.[0]?.text);

    const { error: insertError } = await supabaseAdmin.from('campaigns').insert({
      user_id: user.id,
      opportunity_id: opportunity.id,
      company_name: opportunity.company_name,
      role: opportunity.role,
      subject: outreachResult.subject,
      body: outreachResult.body,
      status: 'draft',
      contact_name: outreachResult.contact_name,
      contact_email: outreachResult.contact_email,
    });

    if (insertError) throw new Error(`Failed to save campaign draft: ${insertError.message}`);

    return new Response(JSON.stringify({ message: "Outreach draft created successfully." }), {
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