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
    const { opportunityIds } = await req.json();
    if (!opportunityIds || !Array.isArray(opportunityIds) || opportunityIds.length === 0) {
      throw new Error("An array of opportunity IDs is required.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const userRes = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
    if (userRes.error) throw new Error("Authentication failed");
    const user = userRes.data.user;

    const { data: opportunities, error: oppError } = await supabaseAdmin
      .from('opportunities')
      .select('id, company_name')
      .in('id', opportunityIds)
      .eq('user_id', user.id);

    if (oppError) throw oppError;
    if (!opportunities || opportunities.length === 0) {
      throw new Error("No valid opportunities found for the current user.");
    }

    const tasksToInsert = opportunities.map(opp => ({
      user_id: user.id,
      opportunity_id: opp.id,
      company_name: opp.company_name,
      status: 'pending'
    }));

    if (tasksToInsert.length > 0) {
      // Insert tasks and get them back
      const { data: savedTasks, error: insertError } = await supabaseAdmin
        .from('contact_enrichment_tasks')
        .insert(tasksToInsert)
        .select();
      
      if (insertError) throw insertError;

      const taskIds = savedTasks.map(t => t.id);

      // Mark tasks as 'processing' immediately
      await supabaseAdmin
        .from('contact_enrichment_tasks')
        .update({ status: 'processing' })
        .in('id', taskIds);

      // Invoke the enrichment function for each task in the background
      const processingPromises = savedTasks.map(task => 
        supabaseAdmin.functions.invoke('find-and-enrich-contacts', {
          body: { opportunityId: task.opportunity_id, taskId: task.id }
        })
      );

      // We don't wait for these to finish, just log if the invocation itself fails
      Promise.allSettled(processingPromises).catch(console.error);
    }

    return new Response(JSON.stringify({ message: `Queued contact search for ${tasksToInsert.length} opportunities.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Batch Create Contact Tasks Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})