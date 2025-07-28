// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const userRes = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
    if (userRes.error) throw new Error("Authentication failed");
    const user = userRes.data.user;

    const { contact_id } = await req.json();
    if (!contact_id) throw new Error("Contact ID is required.");

    const { data: contact, error: contactError } = await supabaseAdmin
      .from('contacts')
      .select('id, name, linkedin_profile_url, job_title')
      .eq('id', contact_id)
      .eq('user_id', user.id)
      .single();

    if (contactError) throw new Error(`Failed to fetch contact: ${contactError.message}`);
    if (!contact.linkedin_profile_url) {
      await supabaseAdmin.from('contacts').update({ email_status: 'error_no_linkedin_url' }).eq('id', contact_id);
      throw new Error("Contact does not have a LinkedIn profile URL.");
    }
    if (!contact.name) {
      await supabaseAdmin.from('contacts').update({ email_status: 'error_no_name' }).eq('id', contact_id);
      throw new Error("Contact does not have a name to verify against.");
    }

    const apolloUrl = `https://app.apollo.io/#/people?q=${encodeURIComponent(contact.linkedin_profile_url)}`;
    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN secret is not set in Supabase.");

    const apifyApiUrl = `https://api.apify.com/v2/acts/microworlds~apollo-scraper/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`;
    
    const apifyInput = {
      "url": apolloUrl,
      "max_result": 5, // Fetch up to 5 results to verify
      "include_email": true,
      "contact_email_status_v2_verified": true,
      "contact_email_exclude_catch_all": true
    };

    const apifyResponse = await fetch(apifyApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apifyInput),
    });

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      throw new Error(`Apify API error: ${apifyResponse.statusText} - ${errorText}`);
    }

    const results = await apifyResponse.json();

    if (results && results.length > 0) {
      // --- Verification Step ---
      const originalName = contact.name.toLowerCase().trim();
      const matchedResult = results.find(r => 
        r.name && r.name.toLowerCase().trim().includes(originalName)
      );

      if (matchedResult) {
        // We found a confident match
        const updatePayload = {
          email: matchedResult.email,
          email_status: matchedResult.email_status || 'verified',
          phone_number: matchedResult.phone,
          job_title: matchedResult.title || contact.job_title, 
        };

        const { data: updatedContact, error: updateError } = await supabaseAdmin
          .from('contacts')
          .update(updatePayload)
          .eq('id', contact_id)
          .select()
          .single();

        if (updateError) throw new Error(`Failed to update contact in DB: ${updateError.message}`);

        return new Response(JSON.stringify({ status: 'success', data: updatedContact }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }
    
    // If we reach here, either no results or no confident match was found
    await supabaseAdmin.from('contacts').update({ email_status: 'not_found' }).eq('id', contact_id);
    return new Response(JSON.stringify({ status: 'not_found', message: "Could not find a verified match in Apollo." }), {
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
})