// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text();
    throw new Error(`Gemini API error: ${geminiResponse.statusText} - ${errorText}`);
  }

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
        signal: AbortSignal.timeout(180000) // 3 minute timeout
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Apify actor ${actorId} failed: ${response.statusText} - ${errorText}`);
    }
    return await response.json();
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    let taskId;
    try {
        const body = await req.json();
        taskId = body.taskId;
        const { opportunityId } = body;
        if (!opportunityId || !taskId) throw new Error("Opportunity ID and Task ID are required.");

        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
        const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");

        if (!GEMINI_API_KEY || !APIFY_API_TOKEN) throw new Error("API keys are not set.");

        const { data: opportunity, error: oppError } = await supabaseAdmin.from('opportunities').select('company_name, role, user_id').eq('id', opportunityId).single();
        if (oppError) throw new Error(`Failed to fetch opportunity: ${oppError.message}`);

        const apolloInput = {
            "company_names": [opportunity.company_name],
            "person_titles": [opportunity.role, "Talent Acquisition", "Recruiter", "Hiring Manager", "Head of People", "CTO", "CEO"],
            "max_people_per_company": 10,
            "include_email": true,
        };
        const apolloResults = await callApifyActor('microworlds~apollo-io-scraper', apolloInput, APIFY_API_TOKEN).catch(e => { console.error("Apollo actor failed:", e.message); return []; });
        const apolloContacts = apolloResults.map(r => ({ name: r.name, job_title: r.title, email: r.email, source: 'Apollo' })).filter(c => c.email);

        const findUrlPrompt = `What is the official website URL for the company "${opportunity.company_name}"? Return a single valid JSON object with one key: "websiteUrl". If you cannot find it, return null.`;
        const urlResult = await callGemini(findUrlPrompt, GEMINI_API_KEY);
        let webScrapeContacts = [];
        if (urlResult.websiteUrl) {
            const deepScrapeInput = { "websites": [urlResult.websiteUrl], "scrapeTypes": ["emails"], "maxDepth": 1 };
            const deepScrapeResults = await callApifyActor('peterasorensen~snacci', deepScrapeInput, APIFY_API_TOKEN).catch(e => { console.error("Deep scrape actor failed:", e.message); return []; });
            if (deepScrapeResults.length > 0 && deepScrapeResults[0].emails) {
                webScrapeContacts = deepScrapeResults[0].emails.map(email => ({ name: 'General Contact', job_title: 'From Website', email, source: 'Website' }));
            }
        }

        const allContacts = [...apolloContacts, ...webScrapeContacts];
        if (allContacts.length === 0) {
            await supabaseAdmin.from('contact_enrichment_tasks').update({ status: 'complete', error_message: 'No contacts found from any source.' }).eq('id', taskId);
            return new Response(JSON.stringify({ message: "No contacts found." }), { status: 200, headers: corsHeaders });
        }

        const rankingPrompt = `You are an expert recruitment researcher. From the following list of potential contacts, select the top 1-3 most relevant individuals to contact for the role of "${opportunity.role}". Prioritize specific, high-level titles over generic ones. Return a single, valid JSON object with one key: "recommended_contacts", containing an array of the full contact objects you selected.`;
        const rankedResult = await callGemini(rankingPrompt, GEMINI_API_KEY);
        const recommendedContacts = rankedResult.recommended_contacts;

        if (!recommendedContacts || recommendedContacts.length === 0) {
            await supabaseAdmin.from('contact_enrichment_tasks').update({ status: 'complete', error_message: 'AI found contacts but none were deemed relevant.' }).eq('id', taskId);
            return new Response(JSON.stringify({ message: "No relevant contacts identified." }), { status: 200, headers: corsHeaders });
        }

        const contactsToInsert = recommendedContacts.map(c => ({
            task_id: taskId, opportunity_id: opportunityId, user_id: opportunity.user_id,
            name: c.name, job_title: c.job_title, email: c.email, email_status: 'verified'
        }));
        const { error: insertError } = await supabaseAdmin.from('contacts').insert(contactsToInsert);
        if (insertError) throw new Error(`Failed to save contacts: ${insertError.message}`);

        await supabaseAdmin.from('contact_enrichment_tasks').update({ status: 'complete' }).eq('id', taskId);

        return new Response(JSON.stringify({ message: `Successfully found and saved ${recommendedContacts.length} contacts.` }), { status: 200, headers: corsHeaders });

    } catch (error) {
        if (taskId) {
            const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
            await supabaseAdmin.from('contact_enrichment_tasks').update({ status: 'error', error_message: error.message }).eq('id', taskId);
        }
        console.error("Automated Contact Discovery Error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
});