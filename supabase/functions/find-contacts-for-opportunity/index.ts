// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function callApifyActor(actorId, input, token) {
    const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(180000) // 3 minute timeout
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Apify actor ${actorId} failed:`, errorText);
      throw new Error(`Apify actor ${actorId} failed: ${response.statusText}`);
    }
    return await response.json();
}

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
      .select('company_name, role, user_id')
      .eq('id', opportunityId)
      .eq('user_id', user.id)
      .single();

    if (oppError) throw new Error(`Failed to fetch opportunity: ${oppError.message}`);

    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN secret is not set.");

    const companyNameEncoded = encodeURIComponent(opportunity.company_name);
    const titles = [opportunity.role, "Hiring Manager", "Talent Acquisition", "Recruiter", "Head of Talent", "Chief People Officer", "VP of People"];
    const titlesEncoded = titles.map(t => `personTitles[]=${encodeURIComponent(t)}`).join('&');
    const apolloUrl = `https://app.apollo.io/#/people?organizationName=${companyNameEncoded}&${titlesEncoded}`;

    const apolloInput = { 
        "url": apolloUrl,
        "max_result": 10,
        "include_email": true
    };
    
    const apolloResults = await callApifyActor('microworlds~apollo-scraper', apolloInput, APIFY_API_TOKEN);

    const contacts = apolloResults.map(r => ({ 
        name: r.name, 
        job_title: r.title, 
        email: r.email,
        phone_number: r.phone_numbers ? r.phone_numbers[0] : null
    })).filter(c => c.email);

    if (contacts.length > 0) {
      const contactsToInsert = contacts.map(c => ({
        opportunity_id: opportunityId,
        user_id: opportunity.user_id,
        name: c.name,
        job_title: c.job_title,
        email: c.email,
        phone_number: c.phone_number,
        email_status: 'verified' // Assumption from Apollo
      }));
      
      const { data: savedContacts, error: insertError } = await supabaseAdmin
        .from('contacts')
        .upsert(contactsToInsert, { onConflict: 'opportunity_id, email' })
        .select();

      if (insertError) throw new Error(`Failed to save contacts: ${insertError.message}`);
      
      return new Response(JSON.stringify({ contacts: savedContacts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ contacts: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Find Contacts error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});