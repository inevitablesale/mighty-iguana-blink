// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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

  const { opportunityId, taskId } = await req.json();
  if (!opportunityId || !taskId) {
    return new Response(JSON.stringify({ error: "Opportunity ID and Task ID are required." }), { status: 400, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");
    if (!RAPIDAPI_KEY) throw new Error("RAPIDAPI_KEY secret is not set in Supabase project secrets.");

    const { data: opportunity, error: oppError } = await supabaseAdmin.from('opportunities').select('company_name, role, user_id, agent_id, likely_decision_maker').eq('id', opportunityId).single();
    if (oppError) throw new Error(`Failed to fetch opportunity: ${oppError.message}`);

    // Step 1: Get Company Profile to find company_id
    const companyProfileResponse = await callRapidApi('/api/v1/company/profile', { company: opportunity.company_name }, RAPIDAPI_KEY);
    
    if (!companyProfileResponse.success || !companyProfileResponse.data?.id) {
        await supabaseAdmin.from('contact_enrichment_tasks').update({ status: 'complete', error_message: 'Could not find company profile on LinkedIn.' }).eq('id', taskId);
        return new Response(JSON.stringify({ message: "No company profile found." }), { status: 200, headers: corsHeaders });
    }
    const companyId = companyProfileResponse.data.id;

    // Step 2: Get Company People using the company_id
    const companyPeopleResponse = await callRapidApi('/api/v1/company/people', { company_id: companyId }, RAPIDAPI_KEY);

    if (!companyPeopleResponse.success || !companyPeopleResponse.data || companyPeopleResponse.data.length === 0) {
        await supabaseAdmin.from('contact_enrichment_tasks').update({ status: 'complete', error_message: 'Company profile found, but no people were listed.' }).eq('id', taskId);
        return new Response(JSON.stringify({ message: "No people found for this company." }), { status: 200, headers: corsHeaders });
    }

    const contactsToInsert = companyPeopleResponse.data.map(p => ({
        task_id: taskId, 
        opportunity_id: opportunityId, 
        user_id: opportunity.user_id,
        name: p.full_name, 
        job_title: p.title, 
        email: null, // IMPORTANT: This API does not provide emails.
        linkedin_profile_url: p.url,
        phone_number: null, // IMPORTANT: This API does not provide phone numbers.
        email_status: null
    }));

    const { data: savedContacts, error: insertError } = await supabaseAdmin
      .from('contacts')
      .upsert(contactsToInsert, { onConflict: 'opportunity_id, linkedin_profile_url' }) // Use linkedin_profile_url for conflict since email is null
      .select();
      
    if (insertError) throw new Error(`Failed to save contacts: ${insertError.message}`);

    await supabaseAdmin.from('contact_enrichment_tasks').update({ status: 'complete' }).eq('id', taskId);

    // NOTE: Automatic outreach generation is skipped because the new API does not provide emails.
    // The logic for this used to be here.

    return new Response(JSON.stringify({ message: `Successfully found and saved ${savedContacts.length} contacts (without emails).` }), { status: 200, headers: corsHeaders });

  } catch (error) {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    await supabaseAdmin.from('contact_enrichment_tasks').update({ status: 'error', error_message: error.message }).eq('id', taskId);
    console.error("Find and Enrich Contacts Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});