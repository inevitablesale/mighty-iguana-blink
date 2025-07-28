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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Fetch top 20 highest-scored, pre-enriched proactive opportunities.
    // Removed the 24-hour time limit to ensure deals are always shown if available.
    const { data: opportunities, error: fetchError } = await supabaseAdmin
      .from('proactive_opportunities')
      .select('id, job_data, relevance_score, relevance_reasoning, contract_value_assessment, hiring_urgency, placement_difficulty, seniority_level')
      .eq('status', 'reviewed')
      .is('user_id', null)
      .order('relevance_score', { ascending: false })
      .limit(20);

    if (fetchError) throw new Error(`Failed to fetch featured opportunities: ${fetchError.message}`);
    
    if (!opportunities || opportunities.length === 0) {
        console.log("[get-featured-opportunities] No reviewed, unassigned opportunities found. Returning empty array.");
        return new Response(JSON.stringify({ opportunities: [] }), { status: 200, headers: corsHeaders });
    }
    
    console.log(`[get-featured-opportunities] Found ${opportunities.length} pre-enriched proactive opportunities.`);

    // Map to the structure expected by the old DealCard, for compatibility.
    const formattedOpportunities = opportunities.map(opp => ({
        id: opp.id,
        company_name: opp.job_data.company,
        role: opp.job_data.title,
        location: opp.job_data.location,
        match_score: opp.relevance_score,
        contract_value_assessment: opp.contract_value_assessment,
        hiring_urgency: opp.hiring_urgency,
        placement_difficulty: opp.placement_difficulty,
        seniority_level: opp.seniority_level,
        company_overview: '', // Not stored in this view, can be enriched on acceptance
        pain_points: '',
        recruiter_angle: '',
        key_signal_for_outreach: opp.relevance_reasoning,
        deal_signals: [
            { type: 'Urgency', value: opp.hiring_urgency, description: 'The company is showing signs of needing to hire quickly.' },
            { type: 'Budget', value: opp.contract_value_assessment, description: 'This is an estimate of the potential placement fee.' }
        ],
    }));

    return new Response(JSON.stringify({ opportunities: formattedOpportunities }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Get Featured Opportunities Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});