// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { opportunityId } = await req.json();
    if (!opportunityId) {
      throw new Error("An opportunity ID is required.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const userRes = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
    if (userRes.error) throw new Error("Authentication failed");
    const user = userRes.data.user;

    const { data: opportunity, error: oppError } = await supabaseAdmin
      .from('opportunities')
      .select('id, company_name')
      .eq('id', opportunityId)
      .eq('user_id', user.id)
      .single();

    if (oppError) throw oppError;
    if (!opportunity) {
      throw new Error("No valid opportunity found for the current user.");
    }

    const taskToInsert = {
      user_id: user.id,
      opportunity_id: opportunity.id,
      company_name: opportunity.company_name,
      status: 'processing' // Set to processing immediately
    };

    const { data: savedTask, error: insertError } = await supabaseAdmin
      .from('contact_enrichment_tasks')
      .insert(taskToInsert)
      .select()
      .single();
    
    if (insertError) throw insertError;

    // Invoke the enrichment function for the task in the background
    const authHeader = req.headers.get('Authorization');
    supabaseAdmin.functions.invoke('find-and-enrich-contacts', {
      headers: { 'Authorization': authHeader },
      body: { opportunityId: savedTask.opportunity_id, taskId: savedTask.id }
    }).catch(console.error);

    return new Response(JSON.stringify({ message: `Queued contact search for ${opportunity.company_name}.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Create Single Contact Task Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})