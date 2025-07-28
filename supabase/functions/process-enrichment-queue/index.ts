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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Find pending tasks
    const { data: pendingTasks, error: fetchError } = await supabaseAdmin
      .from('contact_enrichment_tasks')
      .select('id, opportunity_id')
      .eq('status', 'pending')
      .limit(5); // Process in batches of 5

    if (fetchError) throw new Error(`Failed to fetch pending tasks: ${fetchError.message}`);
    if (!pendingTasks || pendingTasks.length === 0) {
      return new Response(JSON.stringify({ message: "No pending tasks to process." }), { status: 200, headers: corsHeaders });
    }

    // 2. Mark tasks as 'processing' to prevent them from being picked up again
    const taskIds = pendingTasks.map(t => t.id);
    await supabaseAdmin
      .from('contact_enrichment_tasks')
      .update({ status: 'processing' })
      .in('id', taskIds);

    // 3. Invoke the enrichment function for each task. These run in parallel.
    const processingPromises = pendingTasks.map(task => 
      supabaseAdmin.functions.invoke('find-and-enrich-contacts', {
        body: { opportunityId: task.opportunity_id, taskId: task.id }
      })
    );

    await Promise.allSettled(processingPromises);

    return new Response(JSON.stringify({ message: `Successfully started processing for ${pendingTasks.length} tasks.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Process Enrichment Queue Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})