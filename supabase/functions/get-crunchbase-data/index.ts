// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function callApifyActor(input, token) {
    const actorId = 'autoscraping~crunchbase-collect-by-url';
    const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(180000) // 3 minute timeout
    });
    if (!response.ok) {
        throw new Error(`Apify actor ${actorId} failed: ${await response.text()}`);
    }
    return await response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { crunchbase_url } = await req.json();
    if (!crunchbase_url) {
      throw new Error("Crunchbase URL is required.");
    }

    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!APIFY_API_TOKEN) {
      throw new Error("APIFY_API_TOKEN secret is not set.");
    }

    const apifyInput = {
        "urls": [crunchbase_url]
    };

    const results = await callApifyActor(apifyInput, APIFY_API_TOKEN);

    if (!results || results.length === 0) {
        return new Response(JSON.stringify({ data: null, message: "No data found for the provided Crunchbase URL." }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
        });
    }

    return new Response(JSON.stringify({ data: results[0] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Get Crunchbase Data error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});