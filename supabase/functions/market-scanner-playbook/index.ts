// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // This function is designed to be triggered by a schedule, not a direct request.
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const scrapingUrl = "https://coogi-jobspy-production.up.railway.app/jobs?query=&location=usa&sites=linkedin,indeed,zip_recruiter&enforce_annual_salary=true&results_wanted=100&hours_old=24";
    
    console.log(`[market-scanner-playbook] Calling JobSpy with URL: ${scrapingUrl}`);
    const scrapingResponse = await fetch(scrapingUrl, { signal: AbortSignal.timeout(60000) });
    if (!scrapingResponse.ok) {
      throw new Error(`Job scraping API failed: ${await scrapingResponse.text()}`);
    }
    
    const scrapingData = await scrapingResponse.json();
    const rawJobResults = scrapingData?.jobs;

    if (!rawJobResults || rawJobResults.length === 0) {
      return new Response(JSON.stringify({ message: "Market scanner ran but found no new jobs." }), { status: 200, headers: corsHeaders });
    }

    const opportunitiesToInsert = rawJobResults.map(job => ({
      source_query: "High-yield market scan",
      job_data: job,
      status: 'new'
    }));

    const { error: insertError } = await supabaseAdmin
      .from('proactive_opportunities')
      .insert(opportunitiesToInsert);

    if (insertError) {
      console.error(`Failed to insert proactive opportunities:`, insertError.message);
      throw new Error(`Failed to insert proactive opportunities: ${insertError.message}`);
    }

    const message = `Market Scanner Playbook finished. Found and stored ${opportunitiesToInsert.length} new potential opportunities for review.`;
    console.log(message);

    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Market Scanner Playbook failed with a critical error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});