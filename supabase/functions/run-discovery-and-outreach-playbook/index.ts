// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import axios from 'https://esm.sh/axios@1.7.2';

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

    const [agentRes, profileRes] = await Promise.all([
      supabaseAdmin.from('agents').select('prompt, autonomy_level').eq('id', agentId).eq('user_id', user.id).single(),
      supabaseAdmin.from('profiles').select('first_name, calendly_url').eq('id', user.id).single()
    ]);

    if (agentRes.error) throw new Error(`Failed to fetch agent: ${agentRes.error.message}`);
    const agent = agentRes.data;
    const profile = profileRes.data;

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY secret is not set.");

    // --- Step 1: Scrape Jobs using the custom JobSpyMy API ---
    const searchQuery = agent.prompt;
    const scrapingUrl = `https://jobspymy-production.up.railway.app/jobs?query=${encodeURIComponent(searchQuery)}&location=Remote&hours_old=72&results=10`;
    
    const scrapingResponse = await axios.get(scrapingUrl);
    const rawJobResults = scrapingResponse.data?.jobs;

    if (!rawJobResults || rawJobResults.length === 0) {
      await supabaseAdmin.from('agents').update({ last_run_at: new Date().toISOString() }).eq('id', agentId);
      return new Response(JSON.stringify({ message: "Agent ran but found no new job opportunities this time." }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- Step 2: Enrich scraped data with AI analysis ---
    const enrichmentPrompt = `
      You are an expert recruiting analyst. Your task is to analyze a list of raw job data from the JobSpyMy API and enrich it with your expert assessment.
      The recruiter's specialty is: "${agent.prompt}".
      Here is the list of raw job listings:
      ${JSON.stringify(rawJobResults)}

      For each job, provide a JSON object with the following keys:
      - "companyName": The original company name.
      - "role": The original job title.
      - "location": The original location.
      - "potential": Your assessment of the placement's potential value (High, Medium, or Low), considering the salary and company details.
      - "hiringUrgency": Your assessment of the company's hiring urgency (High, Medium, or Low), considering the job description and posting date.
      - "matchScore": A score from 1-10 on how well this job matches the recruiter's specialty.
      - "keySignal": A short, single sentence explaining the most important reason this is a good opportunity (e.g., "The description mentions a direct email, indicating a strong intent to hire.").

      Return ONLY a single, valid JSON object with a key "enriched_opportunities" containing an array of these analysis objects.
    `;

    const enrichmentResult = await callGemini(enrichmentPrompt, GEMINI_API_KEY);
    const enrichedOpportunities = enrichmentResult.enriched_opportunities;

    if (!enrichedOpportunities || enrichedOpportunities.length === 0) {
      throw new Error("AI analysis failed to return enriched opportunities.");
    }

    // --- Step 3: Save Enriched Opportunities ---
    const opportunitiesToInsert = enrichedOpportunities.map(opp => ({
      user_id: user.id,
      agent_id: agentId,
      company_name: opp.companyName,
      role: opp.role,
      location: opp.location,
      potential: opp.potential,
      hiring_urgency: opp.hiringUrgency,
      match_score: opp.matchScore,
      key_signal: opp.keySignal,
    }));

    const { data: savedOpportunities, error: insertOppError } = await supabaseAdmin.from('opportunities').insert(opportunitiesToInsert).select();
    if (insertOppError) throw new Error(`Failed to save opportunities: ${insertOppError.message}`);

    // --- Step 4: Conditional Outreach based on Autonomy Level ---
    if (agent.autonomy_level === 'manual') {
      await supabaseAdmin.from('agents').update({ last_run_at: new Date().toISOString() }).eq('id', agentId);
      return new Response(JSON.stringify({ message: `Agent created ${savedOpportunities.length} opportunities. Please review and approve them.` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // For semi-automatic and automatic, we generate outreach
    const campaignsToInsert = [];
    for (const opp of savedOpportunities) {
      const outreachPrompt = `
        You are an expert business development copywriter for a top-tier recruiter.
        Your task is to write a concise, compelling, and personalized cold email.
        Recruiter's name: ${profile?.first_name || 'your partner at Coogi'}.
        Recruiter's specialties: "${agent.prompt}".
        Opportunity: Company: ${opp.company_name}, Role: ${opp.role}, Key Signal: "${opp.key_signal}".
        Calendly link: ${profile?.calendly_url || '(not provided)'}.
        Guidelines: Professional, concise (2-3 short paragraphs), personalized hook, clear call to action. Do NOT use placeholders.
        Return a JSON object with two keys: "subject" and "body".
      `;
      
      const outreachResult = await callGemini(outreachPrompt, GEMINI_API_KEY);
      
      campaignsToInsert.push({
        user_id: user.id,
        opportunity_id: opp.id,
        company_name: opp.company_name,
        role: opp.role,
        subject: outreachResult.subject,
        body: outreachResult.body,
        status: agent.autonomy_level === 'automatic' ? 'sent' : 'draft',
      });
    }

    const { error: insertCampaignError } = await supabaseAdmin.from('campaigns').insert(campaignsToInsert);
    if (insertCampaignError) throw new Error(`Failed to save campaign drafts: ${insertCampaignError.message}`);

    // --- Step 5: Finalize ---
    await supabaseAdmin.from('agents').update({ last_run_at: new Date().toISOString() }).eq('id', agentId);

    let message = '';
    if (agent.autonomy_level === 'semi-automatic') {
      message = `Agent found and drafted outreach for ${savedOpportunities.length} new opportunities.`;
    } else { // automatic
      message = `Agent found and automatically sent outreach for ${savedOpportunities.length} new opportunities.`;
    }

    return new Response(JSON.stringify({ message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("Edge Function error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});