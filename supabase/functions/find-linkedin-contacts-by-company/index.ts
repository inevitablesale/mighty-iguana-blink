// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to call the RapidAPI with retry logic
async function callRapidApi(endpoint, params, apiKey, retries = 3, delay = 2000) {
    const url = new URL(`https://fresh-linkedin-scraper-api.p.rapidapi.com${endpoint}`);
    url.search = new URLSearchParams(params).toString();

    for (let i = 0; i < retries; i++) {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'x-rapidapi-key': apiKey,
                'x-rapidapi-host': 'fresh-linkedin-scraper-api.p.rapidapi.com'
            },
            signal: AbortSignal.timeout(180000) // 3 minute timeout
        });

        if (response.ok) {
            return await response.json();
        }

        // If rate limited (429), wait and retry
        if (response.status === 429 && i < retries - 1) {
            console.warn(`RapidAPI rate limit hit for ${endpoint}. Retrying in ${delay / 1000}s...`);
            await new Promise(res => setTimeout(res, delay));
            delay *= 2; // Exponential backoff
            continue;
        }

        // For other errors, or if it's the last retry
        const errorText = await response.text();
        console.error(`RapidAPI endpoint ${endpoint} failed with status ${response.status}:`, errorText);
        throw new Error(`RapidAPI endpoint ${endpoint} failed: ${response.statusText}`);
    }
    throw new Error(`RapidAPI call for ${endpoint} failed after ${retries} retries.`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { companyName, keywords } = await req.json();
    if (!companyName) {
      return new Response(JSON.stringify({ error: "Company name is required." }), { status: 400, headers: corsHeaders });
    }

    const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");
    if (!RAPIDAPI_KEY) throw new Error("RAPIDAPI_KEY secret is not set in Supabase project secrets.");

    // Step 1: Get Company Profile to find company_id
    const companyProfileResponse = await callRapidApi('/api/v1/company/profile', { company: companyName }, RAPIDAPI_KEY);
    
    if (!companyProfileResponse.success || !companyProfileResponse.data?.id) {
      throw new Error(`Could not find a LinkedIn profile for "${companyName}".`);
    }
    const companyId = companyProfileResponse.data.id;

    // Step 2: Get Company People using the company_id.
    // NOTE: The 'keywords' parameter is temporarily disabled as it was causing API errors.
    // This will return all available contacts for the company.
    const peopleParams = { company_id: companyId };
    const companyPeopleResponse = await callRapidApi('/api/v1/company/people', peopleParams, RAPIDAPI_KEY);

    if (!companyPeopleResponse.success || !companyPeopleResponse.data || companyPeopleResponse.data.length === 0) {
      return new Response(JSON.stringify({ contacts: [], message: `Found the company, but no people matched the criteria.` }), { status: 200, headers: corsHeaders });
    }

    const contacts = companyPeopleResponse.data.map(p => ({
        name: p.full_name, 
        job_title: p.title, 
        linkedin_profile_url: p.url,
    }));

    return new Response(JSON.stringify({ contacts }), { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error("Find LinkedIn Contacts Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});