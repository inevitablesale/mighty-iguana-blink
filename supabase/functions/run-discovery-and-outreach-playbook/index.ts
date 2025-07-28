// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractLinkedInSlug(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname.includes('linkedin.com') && parsedUrl.pathname.startsWith('/company/')) {
      const parts = parsedUrl.pathname.split('/');
      return parts[2]?.replace(/\/$/, '') || null;
    }
  } catch (e) {
  }
  return null;
}

async function createJobHash(job) {
  const jobString = `${job.title}|${job.company}|${job.location}|${job.description?.substring(0, 500)}`;
  const data = new TextEncoder().encode(jobString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
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

function sanitizeMatchScore(score) {
  if (!score) return 0;
  const cleanedScore = String(score).replace(/[^0-9.]/g, '');
  let numScore = parseFloat(cleanedScore);

  if (isNaN(numScore)) return 0;

  if (numScore > 10) {
    numScore = numScore / 10;
  }

  return Math.max(0, Math.min(10, Math.round(numScore)));
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentId } = await req.json();
    if (!agentId) throw new Error("Agent ID is required.");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const userRes = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
    if (userRes.error) throw new Error("Authentication failed");
    const user = userRes.data.user;

    const { data: agent, error: agentError } = await supabaseAdmin.from('agents').select('prompt, autonomy_level, search_lookback_hours, max_results, job_type, is_remote, country').eq('id', agentId).eq('user_id', user.id).single();
    if (agentError) throw new Error(`Failed to fetch agent: ${agentError.message}`);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY secret is not set.");

    const searchQueryPrompt = `
      Based on the following recruiter specialty description, extract a search query (the core job title or keywords) and a location (city/state/province). **The search query should NOT contain the location name.**
      Recruiter Specialty: "${agent.prompt}"
      Available sites are: linkedin, indeed, zip_recruiter, glassdoor, google, bayt, naukri.
      For most professional roles in the US or Europe, use 'linkedin,indeed,zip_recruiter,glassdoor,google'. If it mentions India, include 'naukri'. If it mentions the Middle East, include 'bayt'.
      If no specific location is mentioned, default the location to "Remote".
      Return ONLY a single, valid JSON object with three keys: "search_query", "location", and "sites".
    `;
    const queryExtractionResult = await callGemini(searchQueryPrompt, GEMINI_API_KEY);
    const { search_query: searchQuery, location, sites } = queryExtractionResult;
    if (!searchQuery || !location || !sites) throw new Error("AI failed to extract search parameters.");

    let scrapingUrl = `https://coogi-jobspy-production.up.railway.app/jobs?query=${encodeURIComponent(searchQuery)}&location=${encodeURIComponent(location)}&sites=${sites}&results=${agent.max_results}`;
    if (agent.country) scrapingUrl += `&country_indeed=${agent.country}`;
    if (agent.job_type) scrapingUrl += `&job_type=${agent.job_type}`;
    if (agent.is_remote) scrapingUrl += `&is_remote=true`;
    if (agent.search_lookback_hours) scrapingUrl += `&hours_old=${agent.search_lookback_hours}`;
    
    const scrapingResponse = await fetch(scrapingUrl, { signal: AbortSignal.timeout(30000) });
    if (!scrapingResponse.ok) throw new Error(`Job scraping API failed: ${await scrapingResponse.text()}`);
    const scrapingData = await scrapingResponse.json();
    const rawJobResults = scrapingData?.jobs;

    if (!rawJobResults || rawJobResults.length === 0) {
      await supabaseAdmin.from('agents').update({ last_run_at: new Date().toISOString() }).eq('id', agentId);
      return new Response(JSON.stringify({ message: `Agent ran but found no new job opportunities.` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const enrichmentPromises = rawJobResults.map(async (job) => {
      const jobHash = await createJobHash(job);
      const { data: cached, error: cacheError } = await supabaseAdmin.from('job_analysis_cache').select('analysis_data').eq('job_hash', jobHash).single();
      
      if (cached && !cacheError) {
        const sanitizedData = cached.analysis_data;
        sanitizedData.match_score = sanitizeMatchScore(sanitizedData.match_score || sanitizedData.matchScore);
        sanitizedData.linkedin_url_slug = extractLinkedInSlug(job.company_linkedin_url);
        return sanitizedData;
      }

      const singleEnrichmentPrompt = `
        You are a world-class recruiting strategist. Analyze the following job posting based on a recruiter's specialty.
        Recruiter's specialty: "${agent.prompt}"
        Job Posting: ${JSON.stringify(job)}
        Return a single, valid JSON object with keys: "companyName", "role", "location", "company_overview", "match_score", "contract_value_assessment", "hiring_urgency", "pain_points", "recruiter_angle", "key_signal_for_outreach".
        **The "match_score" MUST be an integer between 1 and 10.**
        **Crucially, ensure that any double quotes within the string values of the final JSON are properly escaped with a backslash (e.g., "some \\"quoted\\" text").**
      `;
      const analysisData = await callGemini(singleEnrichmentPrompt, GEMINI_API_KEY);
      
      analysisData.match_score = sanitizeMatchScore(analysisData.match_score || analysisData.matchScore);
      analysisData.linkedin_url_slug = extractLinkedInSlug(job.company_linkedin_url);

      const { error: insertCacheError } = await supabaseAdmin.from('job_analysis_cache').insert({ job_hash: jobHash, analysis_data: analysisData });
      if (insertCacheError) console.error(`Failed to cache analysis for ${job.title}:`, insertCacheError.message);
      
      return analysisData;
    });

    const settledEnrichments = await Promise.allSettled(enrichmentPromises);
    const enrichedOpportunities = settledEnrichments
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);
    if (enrichedOpportunities.length === 0) throw new Error("AI analysis failed to enrich any opportunities.");

    const validatedOpportunities = enrichedOpportunities
      .map(opp => {
        const matchScore = opp.match_score;
        if (matchScore < 6) return null;

        return {
          user_id: user.id,
          agent_id: agentId,
          company_name: opp.companyName || opp.company_name,
          role: opp.role,
          location: opp.location || 'N/A',
          company_overview: opp.company_overview || 'N/A',
          match_score: matchScore,
          contract_value_assessment: opp.contract_value_assessment || 'N/A',
          hiring_urgency: opp.hiring_urgency || 'N/A',
          pain_points: opp.pain_points || 'N/A',
          recruiter_angle: opp.recruiter_angle || 'N/A',
          key_signal_for_outreach: opp.key_signal_for_outreach || 'N/A',
          linkedin_url_slug: opp.linkedin_url_slug || null,
        };
      })
      .filter(opp => opp !== null && opp.company_name && opp.role);

    if (validatedOpportunities.length === 0) {
       throw new Error("No valid opportunities to save after validation and filtering.");
    }

    const { data: savedOpportunities, error: insertOppError } = await supabaseAdmin.from('opportunities').insert(validatedOpportunities).select();
    if (insertOppError) throw new Error(`Failed to save opportunities: ${insertOppError.message}`);

    const tasksToInsert = savedOpportunities.map(opp => ({
      user_id: user.id,
      opportunity_id: opp.id,
      company_name: opp.company_name,
      status: 'pending'
    }));

    if (tasksToInsert.length > 0) {
      const { error: insertTaskError } = await supabaseAdmin.from('contact_enrichment_tasks').insert(tasksToInsert);
      if (insertTaskError) {
        console.error("Failed to insert contact discovery tasks:", insertTaskError.message);
      }
    }

    await supabaseAdmin.from('agents').update({ last_run_at: new Date().toISOString() }).eq('id', agentId);
    const message = `Agent run complete. Found ${savedOpportunities.length} new opportunities and queued them for contact discovery.`;
    return new Response(JSON.stringify({ message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("!!! Playbook failed with error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});