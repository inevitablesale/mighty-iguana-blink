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
  
  return JSON.parse(aiResponseText);
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

    const { data: agent, error: agentError } = await supabaseAdmin.from('agents').select('prompt, autonomy_level').eq('id', agentId).eq('user_id', user.id).single();
    if (agentError) throw new Error(`Failed to fetch agent: ${agentError.message}`);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY secret is not set.");

    // --- Step 1: Generate a search query, location, and sites from the agent's prompt ---
    const searchQueryPrompt = `
      Based on the following recruiter specialty description, extract a search query, a location, and a comma-separated list of the most relevant job sites to search.
      Recruiter Specialty: "${agent.prompt}"

      Available sites are: linkedin, indeed, ziprecruiter, glassdoor, google, bayt, naukri.
      For most professional roles in the US or Europe, use 'linkedin,indeed,ziprecruiter,glassdoor,google'. If the specialty mentions India, include 'naukri'. If it mentions the Middle East, include 'bayt'.
      If no specific location is mentioned, default the location to "Remote".

      Return ONLY a single, valid JSON object with three keys: "search_query", "location", and "sites".
    `;
    
    const queryExtractionResult = await callGemini(searchQueryPrompt, GEMINI_API_KEY);
    const { search_query: searchQuery, location, sites } = queryExtractionResult;

    if (!searchQuery || !location || !sites) {
      throw new Error("AI failed to extract a search query, location, and sites from the agent's prompt.");
    }

    // --- Step 2: Scrape Jobs using the custom JobSpyMy API ---
    const scrapingUrl = `https://jobspymy-production.up.railway.app/jobs?query=${encodeURIComponent(searchQuery)}&location=${encodeURIComponent(location)}&sites=${sites}&hours_old=24&results=20`;
    
    const scrapingResponse = await fetch(scrapingUrl, {
      signal: AbortSignal.timeout(30000) // Using native fetch with a 30-second timeout
    });

    if (!scrapingResponse.ok) {
      const errorBody = await scrapingResponse.text();
      throw new Error(`Job scraping API failed with status ${scrapingResponse.status}: ${errorBody}`);
    }

    const scrapingData = await scrapingResponse.json();
    const rawJobResults = scrapingData?.jobs;

    if (!rawJobResults || rawJobResults.length === 0) {
      await supabaseAdmin.from('agents').update({ last_run_at: new Date().toISOString() }).eq('id', agentId);
      return new Response(JSON.stringify({ message: `Agent ran using query "${searchQuery}" in "${location}" on sites [${sites}] but found no new job opportunities this time.` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- Step 3: Enrich scraped data with AI analysis ---
    const enrichmentPrompt = `
      You are a world-class recruiting strategist and business development analyst. Your task is to perform a deep analysis of raw job postings and transform them into actionable intelligence for a recruiter looking for new clients.

      The recruiter's specialty is: "${agent.prompt}".
      Here is the list of raw job listings:
      ${JSON.stringify(rawJobResults)}

      For each job, conduct a thorough analysis and return a JSON object with the following keys:
      - "companyName": The original company name.
      - "role": The original job title.
      - "location": The original location.
      - "company_overview": A single, concise sentence describing what the company does.
      - "match_score": A score from 1-10 on how well this specific role aligns with the recruiter's stated specialty.
      - "contract_value_assessment": A detailed text assessment of the potential contract value (e.g., "High - Executive search for a critical leadership role, likely a retained search with a fee of $75k+"). Be specific about why.
      - "hiring_urgency": Your assessment of the company's hiring urgency (High, Medium, or Low), with a brief justification based on signals in the job description.
      - "pain_points": A bulleted list (as a single string with '\\n- ' separators) of 2-3 specific pain points this role is likely intended to solve for the company.
      - "recruiter_angle": A short, strategic recommendation for how the recruiter should position themselves in their outreach (e.g., "Position yourself as a specialist in scaling Series B fintech engineering teams.").
      - "key_signal_for_outreach": A concise, single sentence that the recruiter can use as a personalized opening line in an outreach email. This should be based on the job description or company.

      Return ONLY a single, valid JSON object with a key "enriched_opportunities" containing an array of these analysis objects. Ensure all fields are populated with insightful, non-generic information.
    `;

    const enrichmentResult = await callGemini(enrichmentPrompt, GEMINI_API_KEY);
    const enrichedOpportunities = enrichmentResult.enriched_opportunities;

    if (!enrichedOpportunities || enrichedOpportunities.length === 0) {
      throw new Error("AI analysis failed to return enriched opportunities.");
    }

    // --- Step 4: Save Enriched Opportunities ---
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

    let outreachMessage = '';

    // --- Step 5: Conditional Outreach Generation (in parallel) ---
    if (agent.autonomy_level === 'semi-automatic' || agent.autonomy_level === 'automatic') {
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
    }

    // --- Step 6: Finalize ---
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