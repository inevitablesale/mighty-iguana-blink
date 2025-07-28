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
    const { campaignId, subject, body } = await req.json();
    if (!campaignId || !subject || !body) {
      throw new Error("Campaign ID, subject, and body are required.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { session } } = await supabaseAdmin.auth.getSession();
    if (!session) throw new Error("Authentication session not found.");
    
    const { user } = session;
    const provider = user.app_metadata.provider;
    const providerToken = session.provider_token;

    if (!providerToken) {
      throw new Error("Email provider not connected or token is missing. Please re-authenticate.");
    }

    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('contact_email')
      .eq('id', campaignId)
      .single();

    if (campaignError) throw new Error(`Failed to fetch campaign: ${campaignError.message}`);
    if (!campaign.contact_email) throw new Error("Campaign is missing a contact email.");

    // Update the campaign with the latest body/subject before sending
    await supabaseAdmin.from('campaigns').update({ subject, body }).eq('id', campaignId);

    if (provider === 'google') {
      const email = [
        `Content-Type: text/html; charset="UTF-8"`,
        `MIME-Version: 1.0`,
        `To: ${campaign.contact_email}`,
        `From: ${user.email}`,
        `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
        '',
        body,
      ].join('\n');

      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${providerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: btoa(unescape(encodeURIComponent(email))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
        }),
      });
      if (!response.ok) throw new Error(`Google API Error: ${await response.text()}`);

    } else if (provider === 'azure') {
      const emailPayload = {
        message: {
          subject: subject,
          body: { contentType: 'HTML', content: body },
          toRecipients: [{ emailAddress: { address: campaign.contact_email } }],
        },
        saveToSentItems: 'true',
      };
      const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${providerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });
      if (!response.ok) throw new Error(`Microsoft Graph API Error: ${await response.text()}`);
    } else {
      throw new Error(`Unsupported email provider: ${provider}`);
    }

    // Mark campaign as contacted
    await supabaseAdmin.from('campaigns').update({ status: 'contacted' }).eq('id', campaignId);

    return new Response(JSON.stringify({ message: "Email sent successfully!" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Send Campaign Email Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});