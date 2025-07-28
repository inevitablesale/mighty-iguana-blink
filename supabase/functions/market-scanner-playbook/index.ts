// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to create a unique fingerprint for a job
async function createJobHash(job) {
  const jobString = `${job.title}|${job.company}|${job.location}|${job.description?.substring(0, 500)}`;
  const data = new TextEncoder().encode(jobString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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

    // UPDATED: Changed hours_old from 24 to 1 to fetch only recent jobs.
    const scrapingUrl = "https://coogi-jobspy-production.up.railway.app/jobs?query=&location=usa&sites=linkedin,indeed,zip_recruiter&enforce_annual_salary=true&results_wanted=100&hours_old=1";
    
    console.log(`[market-scanner-playbook] Calling JobSpy with URL: ${scrapingUrl}`);
    const scrapingResponse = await fetch(scrapingUrl, { signal: AbortSignal.timeout(60000) });
    if (!scrapingResponse.ok) {
      throw new Error(`Job scraping API failed: ${await scrapingResponse.text()}`);
    }
    
    const scrapingData = await scrapingResponse.json();
    const rawJobResults = scrapingData?.jobs;

    if (!rawJobResults || rawJobResults.length === 0) {
      return new Response(JSON.stringify({ message: "Market scanner ran but found no new jobs in the last hour." }), { status: 200, headers: corsHeaders });
    }

    // UPDATED: Calculate hash for each job before inserting.
    const opportunitiesToInsert = await Promise.all(rawJobResults.map(async (job) => {
      const hash = await createJobHash(job);
      return {
        source_query: "High-yield market scan",
        job_data: job,
        status: 'new',
        job_hash: hash,
      };
    }));

    // UPDATED: Use 'upsert' with 'ignore' to silently skip duplicates based on the unique job_hash.
    const { error: insertError } = await supabaseAdmin
      .from('proactive_opportunities')
      .upsert(opportunitiesToInsert, { onConflict: 'job_hash', ignoreDuplicates: true });

    if (insertError) {
      console.error(`Failed to insert proactive opportunities:`, insertError.message);
      throw new Error(`Failed to insert proactive opportunities: ${insertError.message}`);
    }

    const message = `Market Scanner Playbook finished. Processed ${opportunitiesToInsert.length} potential opportunities from the last hour.`;
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