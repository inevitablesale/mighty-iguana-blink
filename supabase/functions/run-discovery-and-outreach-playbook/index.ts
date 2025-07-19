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

    // Fetch agent and user profile in parallel
    const [agentRes, profileRes] = await Promise.all([
      supabaseAdmin.from('agents').select('prompt, autonomy_level').eq('id', agentId).eq('user_id', user.id).single(),
      supabaseAdmin.from('profiles').select('first_name, calendly_url').eq('id', user.id).single()
    ]);

    if (agentRes.error) throw new Error(`Failed to fetch agent: ${agentRes.error.message}`);
    const agent = agentRes.data;
    const profile = profileRes.data;

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");

    // --- Step 1: Discover Opportunities ---
    const discoveryPrompt = `
      You are an AI assistant for a recruiter. Your task is to generate a list of 3 realistic, but fictional, company opportunities based on the recruiter's agent specialty.
      The agent's specialty is: "${agent.prompt}".
      Return ONLY a single, valid JSON object with a key "opportunities" containing an array of 3 opportunities with keys: "companyName", "role", "location", "potential", "hiringUrgency", "matchScore", "keySignal".
    `;
    
    const discoveryResult = await callGemini(discoveryPrompt, GEMINI_API_KEY);
    const discoveredOpportunities = discoveryResult.opportunities;

    if (!discoveredOpportunities || discoveredOpportunities.length === 0) {
      return new Response(JSON.stringify({ message: "Agent ran but found no new opportunities this time." }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- Step 2: Save Opportunities ---
    const opportunitiesToInsert = discoveredOpportunities.map(opp => ({
      user_id: user.id, agent_id: agentId, company_name: opp.companyName, role: opp.role, location: opp.location,
      potential: opp.potential, hiring_urgency: opp.hiringUrgency, match_score: opp.matchScore, key_signal: opp.keySignal,
    }));

    const { data: savedOpportunities, error: insertOppError } = await supabaseAdmin.from('opportunities').insert(opportunitiesToInsert).select();
    if (insertOppError) throw new Error(`Failed to save opportunities: ${insertOppError.message}`);

    // --- Step 3: Conditional Outreach based on Autonomy Level ---
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
        user_id: user.id, opportunity_id: opp.id, company_name: opp.company_name, role: opp.role,
        subject: outreachResult.subject, body: outreachResult.body,
        status: agent.autonomy_level === 'automatic' ? 'sent' : 'draft',
      });
    }

    const { error: insertCampaignError } = await supabaseAdmin.from('campaigns').insert(campaignsToInsert);
    if (insertCampaignError) throw new Error(`Failed to save campaign drafts: ${insertCampaignError.message}`);

    // --- Step 4: Finalize ---
    await supabaseAdmin.from('agents').update({ last_run_at: new Date().toISOString() }).eq('id', agentId);

    let message = '';
    if (agent.autonomy_level === 'semi-automatic') {
      message = `Agent created ${savedOpportunities.length} opportunities and drafted outreach campaigns.`;
    } else { // automatic
      message = `Agent created ${savedOpportunities.length} opportunities and automatically sent outreach.`;
    }

    return new Response(JSON.stringify({ message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("Edge Function error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});