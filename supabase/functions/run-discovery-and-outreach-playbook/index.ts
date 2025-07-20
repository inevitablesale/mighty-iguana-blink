// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to call Gemini API
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

    // --- Step 1: Generate search query ---
    console.log("Step 1: Generating search query from agent prompt...");
    const searchQueryPrompt = `
      Based on the following recruiter specialty description, extract a search query (the core job title or keywords) and a location (city/state/province). **The search query should NOT contain the location name.**
      Recruiter Specialty: "${agent.prompt}"
      Available sites are: linkedin, indeed, zip_recruiter, glassdoor, google, bayt, naukri.
      For most professional roles in the US or Europe, use 'linkedin,indeed,zip_recruiter,glassdoor,google'. If the specialty mentions India, include 'naukri'. If it mentions the Middle East, include 'bayt'.
      If no specific location is mentioned, default the location to "Remote".
      Return ONLY a single, valid JSON object with three keys: "search_query", "location", and "sites".
      Example for "nurses in Georgia": { "search_query": "nurse", "location": "Georgia", "sites": "linkedin,indeed,zip_recruiter,glassdoor,google" }
    `;
    const queryExtractionResult = await callGemini(searchQueryPrompt, GEMINI_API_KEY);
    const { search_query: searchQuery, location, sites } = queryExtractionResult;
    console.log(`Extracted search parameters: Query='${searchQuery}', Location='${location}', Sites='${sites}'`);
    if (!searchQuery || !location || !sites) throw new Error("AI failed to extract search parameters.");

    // --- Step 2: Scrape Jobs ---
    const lookbackHours = parseInt(agent.search_lookback_hours, 10) || 720;
    const maxResults = parseInt(agent.max_results, 10) || 20;
    let scrapingUrl = `https://coogi-jobspy-production.up.railway.app/jobs?query=${encodeURIComponent(searchQuery)}&location=${encodeURIComponent(location)}&sites=${sites}&results=${maxResults}`;
    const usesIndeedOrGlassdoor = sites.includes('indeed') || sites.includes('glassdoor');
    if (usesIndeedOrGlassdoor && agent.country) scrapingUrl += `&country_indeed=${agent.country}`;
    if (usesIndeedOrGlassdoor) {
      if (agent.job_type || agent.is_remote) {
        if (agent.job_type) scrapingUrl += `&job_type=${agent.job_type}`;
        if (agent.is_remote) scrapingUrl += `&is_remote=true`;
      } else {
        scrapingUrl += `&hours_old=${lookbackHours}`;
      }
    } else {
      scrapingUrl += `&hours_old=${lookbackHours}`;
      if (agent.job_type) scrapingUrl += `&job_type=${agent.job_type}`;
      if (agent.is_remote) scrapingUrl += `&is_remote=true`;
    }
    console.log(`Step 2: Scraping jobs from URL: ${scrapingUrl}`);
    const scrapingResponse = await fetch(scrapingUrl, { signal: AbortSignal.timeout(30000) });
    if (!scrapingResponse.ok) {
      const errorBody = await scrapingResponse.text();
      throw new Error(`Job scraping API failed with status ${scrapingResponse.status}: ${errorBody}`);
    }
    const scrapingData = await scrapingResponse.json();
    const rawJobResults = scrapingData?.jobs;
    console.log(`Scraping returned ${rawJobResults?.length || 0} raw job results.`);
    if (!rawJobResults || rawJobResults.length === 0) {
      await supabaseAdmin.from('agents').update({ last_run_at: new Date().toISOString() }).eq('id', agentId);
      return new Response(JSON.stringify({ message: `Agent ran using query "${searchQuery}" in "${location}" on sites [${sites}] but found no new job opportunities this time.` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- Step 3: Enrich scraped data with AI analysis (one by one) ---
    console.log(`Step 3: Enriching ${rawJobResults.length} jobs with AI analysis (one by one)...`);
    
    const enrichmentPromises = rawJobResults.map(job => {
      const singleEnrichmentPrompt = `
        You are a world-class recruiting strategist. Analyze the following job posting based on a recruiter's specialty.
        Recruiter's specialty: "${agent.prompt}"
        Job Posting: ${JSON.stringify(job)}

        Return a single, valid JSON object with the following keys:
        - "companyName": The original company name.
        - "role": The original job title.
        - "location": The original location.
        - "company_overview": A concise sentence about what the company does.
        - "match_score": A score from 1-10 on how well this role aligns with the recruiter's specialty.
        - "contract_value_assessment": A detailed assessment of the potential contract value (e.g., "High - Executive search...").
        - "hiring_urgency": Your assessment of hiring urgency (High, Medium, or Low) with justification.
        - "pain_points": A bulleted list (as a single string with '\\n- ' separators) of 2-3 pain points this role solves.
        - "recruiter_angle": A strategic recommendation for the recruiter's outreach angle.
        - "key_signal_for_outreach": A concise, single sentence for a personalized email opening line.

        **Crucially, ensure that any double quotes within the string values of the final JSON are properly escaped with a backslash (e.g., "some \\"quoted\\" text").**
      `;
      return callGemini(singleEnrichmentPrompt, GEMINI_API_KEY);
    });

    const settledEnrichments = await Promise.allSettled(enrichmentPromises);
    
    const enrichedOpportunities = [];
    settledEnrichments.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        enrichedOpportunities.push(result.value);
      } else {
        console.error(`Failed to enrich job #${index} (${rawJobResults[index].title}):`, result.reason.message);
      }
    });

    if (enrichedOpportunities.length === 0) {
      throw new Error("AI analysis failed to enrich any opportunities.");
    }
    console.log(`Successfully enriched ${enrichedOpportunities.length} opportunities.`);

    // --- Step 4: Save Enriched Opportunities ---
    console.log("Step 4: Saving enriched opportunities to the database...");
    const opportunitiesToInsert = enrichedOpportunities.map(opp => ({
      user_id: user.id,
      agent_id: agentId,
      company_name: opp.companyName,
      role: opp.role,
      location: opp.location,
      company_overview: opp.company_overview,
      match_score: opp.match_score,
      contract_value_assessment: opp.contract_value_assessment,
      hiring_urgency: opp.hiring_urgency,
      pain_points: opp.pain_points,
      recruiter_angle: opp.recruiter_angle,
      key_signal_for_outreach: opp.key_signal_for_outreach,
    }));

    const { data: savedOpportunities, error: insertOppError } = await supabaseAdmin.from('opportunities').insert(opportunitiesToInsert).select();
    if (insertOppError) throw new Error(`Failed to save opportunities: ${insertOppError.message}`);
    console.log(`Saved ${savedOpportunities.length} opportunities.`);

    let outreachMessage = '';

    // --- Step 5: Conditional Outreach Generation ---
    if (agent.autonomy_level === 'semi-automatic' || agent.autonomy_level === 'automatic') {
        console.log(`Step 5: Generating outreach for ${savedOpportunities.length} opportunities...`);
        const { data: profile } = await supabaseAdmin.from('profiles').select('first_name, calendly_url').eq('id', user.id).single();
        
        const campaignPromises = savedOpportunities.map(async (opp) => {
            try {
                const outreachPrompt = `
                  You are an expert business development copywriter for a top-tier recruiter.
                  Your task is to write a concise, compelling, and personalized cold email, and suggest a contact.
                  Recruiter's name: ${profile?.first_name || 'your partner at Coogi'}.
                  Recruiter's specialties: "${agent.prompt}".
                  Opportunity: Company: ${opp.company_name}, Role: ${opp.role}, Key Signal: "${opp.key_signal_for_outreach}".
                  Calendly link: ${profile?.calendly_url || '(not provided)'}.
                  Guidelines: Professional, concise (2-3 short paragraphs), personalized hook, clear call to action. Do NOT use placeholders.
                  Return a JSON object with four keys: "subject", "body", "contact_name" (a plausible job title for the hiring manager, e.g., "Head of Talent Acquisition"), and "contact_email" (a best-guess email address, e.g., "careers@${opp.company_name.toLowerCase().replace(/ /g, '').replace(/\./g, '')}.com").
                  **Crucially, ensure that any double quotes within the string values of the final JSON are properly escaped with a backslash (e.g., "some \\"quoted\\" text").**
                `;

                const outreachResult = await callGemini(outreachPrompt, GEMINI_API_KEY);
                const campaignStatus = agent.autonomy_level === 'automatic' ? 'sent' : 'draft';

                return {
                    user_id: user.id,
                    opportunity_id: opp.id,
                    company_name: opp.company_name,
                    role: opp.role,
                    subject: outreachResult.subject,
                    body: outreachResult.body,
                    status: campaignStatus,
                    contact_name: outreachResult.contact_name,
                    contact_email: outreachResult.contact_email,
                };
            } catch (e) {
                console.error(`Failed to generate outreach for ${opp.company_name}: ${e.message}`);
                return null;
            }
        });

        const campaignsToInsert = (await Promise.all(campaignPromises)).filter(c => c !== null);

        if (campaignsToInsert.length > 0) {
            const { error: insertCampaignError } = await supabaseAdmin.from('campaigns').insert(campaignsToInsert);
            if (insertCampaignError) {
                console.error(`Failed to save campaigns in bulk: ${insertCampaignError.message}`);
            }
        }
        
        const outreachCount = campaignsToInsert.length;
        if (agent.autonomy_level === 'automatic') {
            outreachMessage = `and automatically sent ${outreachCount} outreach emails.`;
        } else {
            outreachMessage = `and created ${outreachCount} outreach drafts for your review.`;
        }
        console.log(`Outreach generation complete. ${outreachMessage}`);
    }

    // --- Step 6: Finalize ---
    console.log("Step 6: Finalizing run and updating agent's last_run_at timestamp.");
    await supabaseAdmin.from('agents').update({ last_run_at: new Date().toISOString() }).eq('id', agentId);

    const message = `Agent run complete. Found and saved ${savedOpportunities.length} new opportunities for "${searchQuery}" in "${location}" on sites [${sites}] ${outreachMessage}`;

    return new Response(JSON.stringify({ message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("Edge Function error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});