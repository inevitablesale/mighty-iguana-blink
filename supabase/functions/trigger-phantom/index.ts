// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId } = await req.json();
    if (!campaignId) throw new Error("Campaign ID is required.");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Fetch campaign and related data
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select(`
        linkedin_message,
        user_id,
        opportunities ( linkedin_profile_url, agent_id )
      `)
      .eq('id', campaignId)
      .single();

    if (campaignError) throw new Error(`Failed to fetch campaign: ${campaignError.message}`);
    if (!campaign.opportunities) throw new Error("Campaign is not linked to a valid opportunity.");

    const { user_id, linkedin_message } = campaign;
    const { linkedin_profile_url, agent_id } = campaign.opportunities;

    if (!linkedin_profile_url) throw new Error("Opportunity has no LinkedIn profile URL.");
    if (!agent_id) throw new Error("Opportunity is not linked to an agent.");

    // 2. Fetch user's Phantombuster API key and Agent's Phantom ID
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('phantombuster_api_key')
      .eq('id', user_id)
      .single();

    if (profileError || !profile?.phantombuster_api_key) {
      throw new Error("Phantombuster API key not found for this user.");
    }

    const { data: agent, error: agentError } = await supabaseAdmin
      .from('agents')
      .select('phantom_id')
      .eq('id', agent_id)
      .single();

    if (agentError || !agent?.phantom_id) {
      throw new Error("Phantombuster Phantom ID not found for this agent.");
    }

    // 3. Call Phantombuster API
    const phantombusterApiKey = profile.phantombuster_api_key;
    const phantomId = agent.phantom_id;
    
    // NOTE: The argument structure assumes the user's Phantom is configured
    // to accept 'profileUrl' and 'message' as input fields.
    const argument = JSON.stringify({
      profileUrl: linkedin_profile_url,
      message: linkedin_message,
    });

    const phantomResponse = await fetch("https://api.phantombuster.com/api/v2/agents/launch", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Phantombuster-Key': phantombusterApiKey,
      },
      body: JSON.stringify({
        id: phantomId,
        argument: argument,
      }),
    });

    if (!phantomResponse.ok) {
      const errorText = await phantomResponse.text();
      throw new Error(`Phantombuster API error: ${errorText}`);
    }

    // 4. Update campaign status
    const { error: updateError } = await supabaseAdmin
      .from('campaigns')
      .update({ status: 'connection_sent' })
      .eq('id', campaignId);

    if (updateError) {
      // Log this, but don't fail the whole operation as the phantom was launched.
      console.error(`Failed to update campaign status: ${updateError.message}`);
    }

    return new Response(JSON.stringify({ message: "Phantombuster connection request launched successfully." }), {
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