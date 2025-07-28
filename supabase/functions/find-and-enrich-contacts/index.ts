// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function callGemini(prompt, apiKey) {
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
  if (!geminiResponse.ok) throw new Error(`Gemini API error: ${await geminiResponse.text()}`);
  const geminiResult = await geminiResponse.json();
  const aiResponseText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!aiResponseText) throw new Error("Failed to get a valid response from Gemini.");
  try {
    return JSON.parse(aiResponseText);
  } catch (e) {
    console.error("Failed to parse Gemini JSON response:", aiResponseText);
    throw new Error(`JSON parsing error: ${e.message}`);
  }
}

async function callApifyActor(actorId, input, token) {
    const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(180000)
    });
    if (!response.ok) throw new Error(`Apify actor ${actorId} failed: ${await response.text()}`);
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
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!GEMINI_API_KEY || !APIFY_API_TOKEN) throw new Error("API keys are not set.");

    const { data: opportunity, error: oppError } = await supabaseAdmin.from('opportunities').select('company_name, role, user_id, agent_id').eq('id', opportunityId).single();
    if (oppError) throw new Error(`Failed to fetch opportunity: ${oppError.message}`);

    let allContacts = [];

    const apolloInput = { 
        "company_names": [opportunity.company_name], 
        "person_titles": [opportunity.role, "Talent Acquisition", "Recruiter", "Hiring Manager"], 
        "max_people_per_company": 10, 
        "person_phone_numbers": "if_available",
        "include_email": true 
    };
    const apolloResults = await callApifyActor('microworlds~apollo-io-scraper', apolloInput, APIFY_API_TOKEN).catch(e => { console.error("Apollo actor failed:", e.message); return []; });
    allContacts.push(...apolloResults.map(r => ({ 
        name: r.name, 
        job_title: r.title, 
        email: r.email, 
        phone_number: r.phone,
        source: 'Apollo' 
    })).filter(c => c.email || c.phone_number));

    const findUrlPrompt = `What is the official website URL for "${opportunity.company_name}"? Return JSON with key "websiteUrl".`;
    const urlResult = await callGemini(findUrlPrompt, GEMINI_API_KEY);
    if (urlResult.websiteUrl) {
        const deepScrapeInput = { "websites": [urlResult.websiteUrl], "scrapeTypes": ["emails"], "maxDepth": 1 };
        const deepScrapeResults = await callApifyActor('peterasorensen~snacci', deepScrapeInput, APIFY_API_TOKEN).catch(e => { console.error("Deep scrape actor failed:", e.message); return []; });
        if (deepScrapeResults.length > 0 && deepScrapeResults[0].emails) {
            allContacts.push(...deepScrapeResults[0].emails.map(email => ({ name: 'General Contact', job_title: 'From Website', email, source: 'Website' })));
        }
    }

    if (allContacts.length === 0) {
        await supabaseAdmin.from('contact_enrichment_tasks').update({ status: 'complete', error_message: 'No contacts found from any source.' }).eq('id', taskId);
        return new Response(JSON.stringify({ message: "No contacts found." }), { status: 200, headers: corsHeaders });
    }

    const rankingPrompt = `You are an expert recruitment researcher. You have been given a list of potential contacts from various sources (LinkedIn, Apollo, Website). Your task is to intelligently rank all of these contacts from most to least relevant for the role of "${opportunity.role}" at "${opportunity.company_name}". Consider the contact's job title and the reliability of their source (LinkedIn and Apollo are more reliable than a generic website email). Return a single, valid JSON object with one key: "ranked_contacts". The value should be an array of ALL the original contact objects, sorted by relevance (most relevant first).`;
    const rankedResult = await callGemini(rankingPrompt, GEMINI_API_KEY);
    const rankedContacts = (rankedResult.ranked_contacts || []).slice(0, 10);

    if (rankedContacts.length === 0) {
        await supabaseAdmin.from('contact_enrichment_tasks').update({ status: 'complete', error_message: 'AI found contacts but none were deemed relevant.' }).eq('id', taskId);
        return new Response(JSON.stringify({ message: "No relevant contacts identified." }), { status: 200, headers: corsHeaders });
    }

    const contactsToInsert = rankedContacts.map(c => ({
        task_id: taskId, opportunity_id: opportunityId, user_id: opportunity.user_id,
        name: c.name, job_title: c.job_title, email: c.email, phone_number: c.phone_number, linkedin_profile_url: c.linkedin_profile_url,
        email_status: c.email ? 'verified' : null
    }));
    const { data: savedContacts, error: insertError } = await supabaseAdmin.from('contacts').insert(contactsToInsert).select();
    if (insertError) throw new Error(`Failed to save contacts: ${insertError.message}`);

    await supabaseAdmin.from('contact_enrichment_tasks').update({ status: 'complete' }).eq('id', taskId);

    if (opportunity.agent_id) {
        const { data: agent } = await supabaseAdmin.from('agents').select('autonomy_level').eq('id', opportunity.agent_id).single();
        if (agent && (agent.autonomy_level === 'semi-automatic' || agent.autonomy_level === 'automatic')) {
            const authHeader = req.headers.get('Authorization');
            const topContact = savedContacts.find(c => c.email);
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