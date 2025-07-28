// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Define broad search queries for the market scanner
const BROAD_SEARCHES = [
    { query: "software engineer", location: "USA", sites: "linkedin,google,indeed" },
    { query: "sales director", location: "USA", sites: "linkedin,google,indeed" },
    { query: "product manager", location: "Remote", sites: "linkedin,google,indeed" },
    { query: "data scientist", location: "Europe", sites: "linkedin,google,indeed" },
];

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

    let totalJobsFound = 0;

    for (const search of BROAD_SEARCHES) {
      try {
        const scrapingUrl = `https://coogi-jobspy-production.up.railway.app/jobs?query=${encodeURIComponent(search.query)}&location=${encodeURIComponent(search.location)}&sites=${search.sites}&results=50`;
        
        const scrapingResponse = await fetch(scrapingUrl, { signal: AbortSignal.timeout(60000) });
        if (!scrapingResponse.ok) {
          console.error(`Job scraping API failed for query "${search.query}": ${await scrapingResponse.text()}`);
          continue;
        }
        
        const scrapingData = await scrapingResponse.json();
        const rawJobResults = scrapingData?.jobs;

        if (!rawJobResults || rawJobResults.length === 0) {
          continue;
        }

        const opportunitiesToInsert = rawJobResults.map(job => ({
          source_query: `${search.query} in ${search.location}`,
          job_data: job,
          status: 'new'
        }));

        const { error: insertError } = await supabaseAdmin
          .from('proactive_opportunities')
          .insert(opportunitiesToInsert);

        if (insertError) {
          console.error(`Failed to insert proactive opportunities for query "${search.query}":`, insertError.message);
        } else {
          totalJobsFound += opportunitiesToInsert.length;
        }
      } catch (e) {
        console.error(`Error processing search query "${search.query}":`, e.message);
        continue;
      }
    }

    const message = `Market Scanner Playbook finished. Found and stored ${totalJobsFound} new potential opportunities for review.`;
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