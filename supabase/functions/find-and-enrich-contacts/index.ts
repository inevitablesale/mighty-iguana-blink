// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// New helper function to call Apify
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
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const { opportunityId, taskId } = await req.json();
  if (!opportunityId || !taskId) {
    return new Response(JSON.stringify({ error: "Opportunity ID and Task ID are required." }), { status: 400, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN secret is not set.");

    const { data: opportunity, error: oppError } = await supabaseAdmin.from('opportunities').select('company_name, role, user_id, agent_id, likely_decision_maker').eq('id', opportunityId).single();
    if (oppError) throw new Error(`Failed to fetch opportunity: ${oppError.message}`);

    // --- Start of new logic: Using Apify/Apollo instead of Gemini ---
    const companyNameEncoded = encodeURIComponent(opportunity.company_name);
    // Use a broader set of titles to increase chances of finding a match
    const titles = [
        opportunity.likely_decision_maker,
        opportunity.role, 
        "Hiring Manager", 
        "Talent Acquisition", 
        "Recruiter", 
        "Head of Talent", 
        "Chief People Officer", 
        "VP of People",
        "CEO",
        "Founder"
    ].filter(Boolean); // Filter out any null/undefined values

    const titlesEncoded = titles.map(t => `personTitles[]=${encodeURIComponent(t)}`).join('&');
    const apolloUrl = `https://app.apollo.io/#/people?organizationName=${companyNameEncoded}&${titlesEncoded}`;

    const apolloInput = { 
        "url": apolloUrl,
        "max_result": 5, // Get a few top results
        "include_email": true
    };
    
    const apolloResults = await callApifyActor('microworlds~apollo-scraper', apolloInput, APIFY_API_TOKEN);
    // --- End of new logic ---

    if (!apolloResults || apolloResults.length === 0) {
        await supabaseAdmin.from('contact_enrichment_tasks').update({ status: 'complete', error_message: 'Apollo.io search completed but found no contacts.' }).eq('id', taskId);
        return new Response(JSON.stringify({ message: "No contacts found." }), { status: 200, headers: corsHeaders });
    }

    const contactsToInsert = apolloResults.map(c => ({
        task_id: taskId, 
        opportunity_id: opportunityId, 
        user_id: opportunity.user_id,
        name: c.name, 
        job_title: c.title, 
        email: c.email,
        linkedin_profile_url: c.linkedinUrl, // Correct field from apollo-scraper
        phone_number: c.phone_numbers ? c.phone_numbers[0] : null,
        email_status: c.email ? 'verified' : null // Assume verified from Apollo
    })).filter(c => c.email); // Only insert contacts with an email

    if (contactsToInsert.length === 0) {
        await supabaseAdmin.from('contact_enrichment_tasks').update({ status: 'complete', error_message: 'Apollo.io found contacts, but none had emails.' }).eq('id', taskId);
        return new Response(JSON.stringify({ message: "No contacts with emails found." }), { status: 200, headers: corsHeaders });
    }

    const { data: savedContacts, error: insertError } = await supabaseAdmin
      .from('contacts')
      .upsert(contactsToInsert, { onConflict: 'opportunity_id, email' }) // Use upsert to avoid duplicates
      .select();
      
    if (insertError) throw new Error(`Failed to save contacts: ${insertError.message}`);

    await supabaseAdmin.from('contact_enrichment_tasks').update({ status: 'complete' }).eq('id', taskId);

    if (opportunity.agent_id) {
        const { data: agent } = await supabaseAdmin.from('agents').select('autonomy_level').eq('id', opportunity.agent_id).single();
        if (agent && (agent.autonomy_level === 'semi-automatic' || agent.autonomy_level === 'automatic')) {
            const authHeader = req.headers.get('Authorization');
            const topContact = savedContacts[0]; // The first result is likely the best
            if (topContact && authHeader) {
                await supabaseAdmin.functions.invoke('generate-outreach-for-opportunity', {
                    headers: { 'Authorization': authHeader },
                    body: { 
                      opportunityId, 
                      contact: topContact, 
                      isAutomatic: agent.autonomy_level === 'automatic' 
                    }
                });
            }
        }
    }

    return new Response(JSON.stringify({ message: `Successfully found and saved ${savedContacts.length} contacts.` }), { status: 200, headers: corsHeaders });

  } catch (error) {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    await supabaseAdmin.from('contact_enrichment_tasks').update({ status: 'error', error_message: error.message }).eq('id', taskId);
    console.error("Find and Enrich Contacts Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});