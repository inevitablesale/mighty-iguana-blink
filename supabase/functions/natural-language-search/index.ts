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
  } catch (e) { /* Ignore invalid URLs */ }
  return null;
}

async function createJobHash(job) {
  const jobString = `${job.title}|${job.company}|${job.location}|${job.description?.substring(0, 500)}`;
  const data = new TextEncoder().encode(jobString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
  if (numScore > 10) numScore /= 10;
  return Math.max(0, Math.min(10, Math.round(numScore)));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query) throw new Error("Search query is required.");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const userRes = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
    if (userRes.error) throw new Error("Authentication failed");
    const user = userRes.data.user;

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY secret is not set.");

    const searchQueryPrompt = `
      Analyze the user's search query to extract structured search parameters.
      User Query: "${query}"
      Available sites are: linkedin, indeed, zip_recruiter, glassdoor, google, bayt, naukri.
      For most professional roles in the US or Europe, use 'linkedin,indeed,zip_recruiter,glassdoor,google'. If it mentions India, include 'naukri'. If it mentions the Middle East, include 'bayt'.
      If no specific location is mentioned, default the location to "Remote".
      Also, create a concise "recruiter_specialty" string that summarizes the user's intent (e.g., "placing senior engineers in high-growth B2B software companies"). This will be used for analysis.
      Return ONLY a single, valid JSON object with keys: "search_query", "location", "sites", and "recruiter_specialty".
    `;
    const { search_query, location, sites, recruiter_specialty } = await callGemini(searchQueryPrompt, GEMINI_API_KEY);
    if (!search_query || !location || !sites || !recruiter_specialty) throw new Error("AI failed to extract search parameters from your query.");

    const scrapingUrl = `https://coogi-jobspy-production.up.railway.app/jobs?query=${encodeURIComponent(search_query)}&location=${encodeURIComponent(location)}&sites=${sites}&results=20`;
    const scrapingResponse = await fetch(scrapingUrl, { signal: AbortSignal.timeout(45000) });
    if (!scrapingResponse.ok) throw new Error(`Job scraping API failed: ${await scrapingResponse.text()}`);
    const scrapingData = await scrapingResponse.json();
    const rawJobResults = scrapingData?.jobs;

    if (!rawJobResults || rawJobResults.length === 0) {
      return new Response(JSON.stringify({ opportunities: [] }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const enrichmentPromises = rawJobResults.map(async (job) => {
      const jobHash = await createJobHash(job);
      const { data: cached } = await supabaseAdmin.from('job_analysis_cache').select('analysis_data').eq('job_hash', jobHash).single();
      
      if (cached) {
        const sanitizedData = cached.analysis_data;
        sanitizedData.match_score = sanitizeMatchScore(sanitizedData.match_score || sanitizedData.matchScore);
        sanitizedData.linkedin_url_slug = extractLinkedInSlug(job.company_linkedin_url);
        return sanitizedData;
      }

      const singleEnrichmentPrompt = `
        You are a world-class recruiting strategist. Analyze the following job posting based on a recruiter's stated specialty.
        Recruiter's specialty: "${recruiter_specialty}"
        Job Posting: ${JSON.stringify(job)}
        Return a single, valid JSON object with keys: "companyName", "role", "location", "company_overview", "match_score", "contract_value_assessment", "hiring_urgency", "pain_points", "recruiter_angle", "key_signal_for_outreach".
        **The "match_score" MUST be an integer between 1 and 10.**
        **Crucially, ensure that any double quotes within the string values of the final JSON are properly escaped with a backslash (e.g., "some \\"quoted\\" text").**
      `;
      const analysisData = await callGemini(singleEnrichmentPrompt, GEMINI_API_KEY);
      
      analysisData.match_score = sanitizeMatchScore(analysisData.match_score || analysisData.matchScore);
      analysisData.linkedin_url_slug = extractLinkedInSlug(job.company_linkedin_url);

      await supabaseAdmin.from('job_analysis_cache').insert({ job_hash: jobHash, analysis_data: analysisData });
      
      return analysisData;
    });

    const settledEnrichments = await Promise.allSettled(enrichmentPromises);
    const enrichedOpportunities = settledEnrichments
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);

    const opportunitiesToInsert = enrichedOpportunities.map(opp => ({
        user_id: user.id,
        company_name: opp.companyName || opp.company_name,
        role: opp.role,
        location: opp.location || 'N/A',
        company_overview: opp.company_overview || 'N/A',
        match_score: opp.match_score,
        contract_value_assessment: opp.contract_value_assessment || 'N/A',
        hiring_urgency: opp.hiring_urgency || 'N/A',
        pain_points: opp.pain_points || 'N/A',
        recruiter_angle: opp.recruiter_angle || 'N/A',
        key_signal_for_outreach: opp.key_signal_for_outreach || 'N/A',
        linkedin_url_slug: opp.linkedin_url_slug || null,
    }));

    if (opportunitiesToInsert.length === 0) {
        return new Response(JSON.stringify({ opportunities: [] }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: savedOpportunities, error: insertOppError } = await supabaseAdmin.from('opportunities').insert(opportunitiesToInsert).select();
    if (insertOppError) throw new Error(`Failed to save opportunities: ${insertOppError.message}`);

    const tasksToInsert = savedOpportunities.map(opp => ({
        user_id: user.id,
        opportunity_id: opp.id,
        company_name: opp.company_name,
        status: 'pending'
    }));

    if (tasksToInsert.length > 0) {
        await supabaseAdmin.from('contact_enrichment_tasks').insert(tasksToInsert);
    }

    return new Response(JSON.stringify({ opportunities: savedOpportunities }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Natural Language Search Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});