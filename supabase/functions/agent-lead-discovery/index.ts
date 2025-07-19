// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { v4 as uuidv4 } from 'https://esm.sh/uuid@10.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Authenticate user from request
    const userRes = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
    if (userRes.error) throw new Error("Authentication failed");
    const user = userRes.data.user;

    // 1. Fetch agent prompt
    const { data: agent, error: agentError } = await supabaseAdmin
      .from('agents')
      .select('prompt')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single();

    if (agentError) throw new Error(`Failed to fetch agent: ${agentError.message}`);

    // 2. Call Gemini to generate opportunities
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");

    const prompt = `
      You are an AI assistant for a recruiter. Your task is to generate a list of 5 realistic, but fictional, company opportunities based on the recruiter's agent specialty.
      The agent's specialty is: "${agent.prompt}".

      For each opportunity, you MUST include:
      - "companyName": Fictional Company Name
      - "role": The specific role they are hiring for
      - "location": A plausible city and state for the company
      - "potential": A value (High, Medium, or Low)
      - "hiringUrgency": A value (High, Medium, or Low)
      - "matchScore": A score from 1-10 indicating how strong a fit this lead is.
      - "keySignal": The single most important *hypothetical* reason this is a good lead (e.g., "Just raised $20M Series B", "Hiring velocity increased 50%").

      Return ONLY a single, valid JSON object with a key "opportunities" containing an array of these 5 opportunities. Do not include any other text, explanations, or markdown.
    `;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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
    const opportunities = JSON.parse(geminiResult.candidates[0].content.parts[0].text).opportunities;

    // 3. Save opportunities to the database
    const opportunitiesToInsert = opportunities.map(opp => ({
      id: uuidv4(),
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

    const { error: insertError } = await supabaseAdmin.from('opportunities').insert(opportunitiesToInsert);
    if (insertError) throw new Error(`Failed to save opportunities: ${insertError.message}`);

    // 4. Update agent's last_run_at timestamp
    await supabaseAdmin.from('agents').update({ last_run_at: new Date().toISOString() }).eq('id', agentId);

    return new Response(JSON.stringify({ message: `Found ${opportunities.length} new opportunities.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Edge Function error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});