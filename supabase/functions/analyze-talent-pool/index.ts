// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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
      const errorBody = await response.text();
      throw new Error(`Apify actor ${actorId} failed: ${response.statusText} - ${errorBody}`);
    }
    return await response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyName } = await req.json();
    if (!companyName) {
      throw new Error("Company name is required.");
    }

    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!APIFY_API_TOKEN) {
      throw new Error("APIFY_API_TOKEN secret is not set in Edge Function secrets.");
    }

    const apolloInput = { 
        "company_names": [companyName],
        "max_people_per_company": 25,
        "person_phone_numbers": "if_available",
        "include_email": true 
    };

    const apolloResults = await callApifyActor('microworlds~apollo-io-scraper', apolloInput, APIFY_API_TOKEN);

    const profiles = apolloResults.map(r => ({ 
        name: r.name, 
        title: r.title, 
        company: r.organization?.name,
        linkedin_url: r.linkedin_url,
        email: r.email,
    }));

    return new Response(JSON.stringify({ profiles }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Analyze Talent Pool Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});