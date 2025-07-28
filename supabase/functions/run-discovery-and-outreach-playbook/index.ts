// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Helper functions ---
async function callGemini(prompt, apiKey, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
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

      if (geminiResponse.status === 503) {
        if (i < retries - 1) {
          console.warn(`Gemini API returned 503. Retrying in ${delay / 1000}s... (${i + 1}/${retries})`);
          await new Promise(res => setTimeout(res, delay));
          delay *= 2; // Exponential backoff
          continue;
        } else {
          throw new Error(`Gemini API error: The model is overloaded. Please try again later. (Status: 503)`);
        }
      }

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
    } catch (error) {
      if (i === retries - 1) throw error;
    }
  }
  throw new Error("Gemini API call failed after multiple retries.");
}

async function createJobHash(job) {
  const jobString = `${job.title}|${job.company}|${job.location}|${job.description?.substring(0, 500)}`;
  const data = new TextEncoder().encode(jobString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function sanitizeMatchScore(score) {
  if (!score) return 0;
  const cleanedScore = String(score).replace(/[^0-9.]/g, '');
  let numScore = parseFloat(cleanedScore);
  if (isNaN(numScore)) return 0;
  if (numScore > 10) numScore /= 10;
  return Math.max(0, Math.min(10, Math.round(numScore)));
}
// --- End Helper Functions ---

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentId } = await req.json();
    if (!agentId) throw new Error("Agent ID is required.");

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const userRes = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
    if (userRes.error) throw new Error("Authentication failed");
    const user = userRes.data.user;

    const { data: agent, error: agentError } = await supabaseAdmin.from('agents').select('*').eq('id', agentId).eq('user_id', user.id).single();
    if (agentError) throw new Error(`Failed to fetch agent: ${agentError.message}`);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");

    // Step 1: Find relevant jobs
    const searchQueryPrompt = `Based on the following recruiter specialty, extract a search query and location. Specialty: "${agent.prompt}". Return JSON with "search_query" and "location".`;
    const { search_query, location } = await callGemini(searchQueryPrompt, GEMINI_API_KEY);
    
    const params = new URLSearchParams({
      query: search_query,
      location: location,
      results: agent.max_results || 20,
      enforce_annual_salary: 'true',
    });

    if (agent.site_names && agent.site_names.length > 0) params.append('sites', agent.site_names.join(','));
    if (agent.search_lookback_hours) params.append('hours_old', agent.search_lookback_hours);
    if (agent.job_type) params.append('job_type', agent.job_type);
    if (agent.is_remote) params.append('is_remote', 'true');
    if (agent.distance) params.append('distance', agent.distance);
    if (agent.country) params.append('country_indeed', agent.country);
    if (agent.google_search_term) params.append('google_search_term', agent.google_search_term);

    const scrapingUrl = `https://coogi-jobspy-production.up.railway.app/jobs?${params.toString()}`;
    const scrapingResponse = await fetch(scrapingUrl, { signal: AbortSignal.timeout(60000) });
    if (!scrapingResponse.ok) throw new Error(`Job scraping API failed: ${await scrapingResponse.text()}`);
    const rawJobResults = (await scrapingResponse.json())?.jobs;

    let message;

    if (!rawJobResults || rawJobResults.length === 0) {
      message = `Agent "${agent.name}" ran but found no new job opportunities.`;
    } else {
      // Step 2: Enrich and filter jobs
      const enrichmentPromises = rawJobResults.map(async (job) => {
        const jobHash = await createJobHash(job);
        const { data: cached } = await supabaseAdmin.from('job_analysis_cache').select('analysis_data').eq('job_hash', jobHash).single();
        if (cached) return { ...cached.analysis_data, match_score: sanitizeMatchScore(cached.analysis_data.match_score) };

        const enrichmentPrompt = `Analyze this job based on this specialty: "${agent.prompt}". Job: ${JSON.stringify(job)}. Return JSON with "companyName", "role", "location", "company_overview", "match_score", "contract_value_assessment", "hiring_urgency", "pain_points", "recruiter_angle", "key_signal_for_outreach", etc.`;
        const analysisData = await callGemini(enrichmentPrompt, GEMINI_API_KEY);
        analysisData.match_score = sanitizeMatchScore(analysisData.match_score);
        await supabaseAdmin.from('job_analysis_cache').insert({ job_hash: jobHash, analysis_data: analysisData });
        return analysisData;
      });

      const settledEnrichments = await Promise.allSettled(enrichmentPromises);
      const enrichedOpportunities = settledEnrichments.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
      const validatedOpportunities = enrichedOpportunities.filter(opp => opp.match_score >= 6);

      if (validatedOpportunities.length === 0) {
        message = `Agent "${agent.name}" ran and analyzed ${enrichedOpportunities.length} jobs, but none met the quality threshold.`;
      } else {
        // Step 3: Save opportunities
        const opportunitiesToInsert = validatedOpportunities.map(opp => ({
            user_id: user.id, agent_id: agentId, company_name: opp.companyName, role: opp.role, location: opp.location,
            match_score: opp.match_score, company_overview: opp.company_overview, contract_value_assessment: opp.contract_value_assessment,
            hiring_urgency: opp.hiring_urgency, pain_points: opp.pain_points, recruiter_angle: opp.recruiter_angle,
            key_signal_for_outreach: opp.key_signal_for_outreach, placement_difficulty: opp.placement_difficulty,
            estimated_time_to_fill: opp.estimated_time_to_fill, client_demand_signal: opp.client_demand_signal,
            location_flexibility: opp.location_flexibility, seniority_level: opp.seniority_level, likely_decision_maker: opp.likely_decision_maker,
        }));
        const { data: savedOpportunities, error: insertOppError } = await supabaseAdmin.from('opportunities').insert(opportunitiesToInsert).select();
        if (insertOppError) throw new Error(`Failed to save opportunities: ${insertOppError.message}`);

        message = `Agent "${agent.name}" found and processed ${savedOpportunities.length} new opportunities based on your autonomy settings.`;

        if (agent.autonomy_level !== 'manual') {
          // Step 4: For semi-auto or auto, find contacts and generate outreach
          const authHeader = req.headers.get('Authorization');
          for (const opp of savedOpportunities) {
            const { data: newTask, error: taskError } = await supabaseAdmin.from('contact_enrichment_tasks').insert({
              user_id: user.id, opportunity_id: opp.id, company_name: opp.company_name, status: 'pending'
            }).select('id').single();

            if (taskError || !newTask) { 
              console.error(`Failed to create task for opp ${opp.id}`); 
              continue; 
            }

            // This is a non-blocking call
            supabaseAdmin.functions.invoke('find-and-enrich-contacts', {
              headers: { 'Authorization': authHeader },
              body: { opportunityId: opp.id, taskId: newTask.id }
            });
          }
        }
      }
    }
    
    // Post summary to feed
    await supabaseAdmin.from('feed_items').insert({
      user_id: user.id,
      type: 'agent_run_summary',
      role: 'system',
      content: {
        agentName: agent.name,
        summary: message,
      }
    });

    await supabaseAdmin.from('agents').update({ last_run_at: new Date().toISOString() }).eq('id', agentId);
    return new Response(JSON.stringify({ message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("!!! Playbook failed with error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});