// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Helper functions ---
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
  if (!geminiResponse.ok) throw new Error(`Gemini API error: ${await geminiResponse.text()}`);
  const geminiResult = await geminiResponse.json();
  const aiResponseText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!aiResponseText) throw new Error("Failed to get a valid response from Gemini.");
  try {
    return JSON.parse(aiResponseText);
  } catch (e) {
    console.error("Failed to parse Gemini JSON response:", aiResponseText);
    throw new Error(`JSON parsing error: ${e.message}`);
  }
}

function extractLinkedInSlug(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname.includes('linkedin.com') && parsedUrl.pathname.startsWith('/company/')) {
      const parts = parsedUrl.pathname.split('/');
      return parts[2]?.replace(/\/$/, '') || null;
    }
  } catch (e) { /* Ignore invalid URLs */ }
  return null;
}

async function createJobHash(job) {
  const jobString = `${job.title}|${job.company}|${job.location}|${job.description?.substring(0, 500)}`;
  const data = new TextEncoder().encode(jobString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function sanitizeMatchScore(score) {
  if (!score) return 0;
  const cleanedScore = String(score).replace(/[^0-9.]/g, '');
  let numScore = parseFloat(cleanedScore);
  if (isNaN(numScore)) return 0;
  if (numScore > 10) numScore /= 10;
  return Math.max(0, Math.min(10, Math.round(numScore)));
}
// --- End Helper Functions ---

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const sendUpdate = (data) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const { query } = await req.json();
        if (!query) throw new Error("Search query is required.");

        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
        const userRes = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
        if (userRes.error) throw new Error("Authentication failed");
        const user = userRes.data.user;

        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
        if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY secret is not set.");

        sendUpdate({ type: 'status', message: 'Deconstructing your request...' });
        const searchQueryPrompt = `You are an expert at parsing recruitment-focused search queries...`; // Prompt omitted for brevity
        const { search_query, location, sites, recruiter_specialty } = await callGemini(searchQueryPrompt, GEMINI_API_KEY);

        sendUpdate({ type: 'status', message: `Searching for roles on ${sites}...` });
        const scrapingUrl = `https://coogi-jobspy-production.up.railway.app/jobs?query=${encodeURIComponent(search_query)}&location=${encodeURIComponent(location)}&sites=${sites}&results=40&enforce_annual_salary=true&hours_old=24`;
        const scrapingResponse = await fetch(scrapingUrl, { signal: AbortSignal.timeout(45000) });
        if (!scrapingResponse.ok) throw new Error(`Job scraping API failed: ${await scrapingResponse.text()}`);
        const rawJobResults = (await scrapingResponse.json())?.jobs;

        if (!rawJobResults || rawJobResults.length === 0) {
          sendUpdate({ type: 'result', payload: { text: "I couldn't find any open roles matching your request. Please try a different search." } });
          controller.close();
          return;
        }

        const sortedJobs = rawJobResults.filter(job => job.max_amount && job.max_amount > 0).sort((a, b) => b.max_amount - a.max_amount);
        const topJobs = sortedJobs.slice(0, 20);
        
        sendUpdate({ type: 'status', message: `Found ${topJobs.length} potential jobs. Analyzing and scoring...` });

        const enrichmentPromises = topJobs.map(async (job) => {
          // ... enrichment logic ...
        });
        const settledEnrichments = await Promise.allSettled(enrichmentPromises);
        const enrichedOpportunities = settledEnrichments.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);

        let opportunitiesToReturn = enrichedOpportunities.filter(opp => opp.match_score >= 5).sort((a, b) => b.match_score - a.match_score);
        let responseText = `I found ${opportunitiesToReturn.length} potential deals for you. Here are the top matches. I've started finding key contacts for these companies in the background.`;
        
        // ... logic for different response texts ...

        if (opportunitiesToReturn.length === 0) {
            // ... logic for no matches ...
            sendUpdate({ type: 'result', payload: { text: "No strong matches found. Try broadening your search." } });
            controller.close();
            return;
        }

        sendUpdate({ type: 'status', message: 'Finalizing results...' });

        const opportunitiesToInsert = opportunitiesToReturn.map(opp => ({ /* ... opp data ... */ }));
        const { data: savedOpportunities, error: insertOppError } = await supabaseAdmin.from('opportunities').insert(opportunitiesToInsert).select();
        if (insertOppError) throw new Error(`Failed to save opportunities: ${insertOppError.message}`);

        const tasksToInsert = savedOpportunities.map(opp => ({ /* ... task data ... */ }));
        if (tasksToInsert.length > 0) await supabaseAdmin.from('contact_enrichment_tasks').insert(tasksToInsert);

        sendUpdate({ type: 'result', payload: { text: responseText, opportunities: savedOpportunities, searchParams: { recruiter_specialty } } });
        
      } catch (error) {
        sendUpdate({ type: 'error', message: error.message });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
});