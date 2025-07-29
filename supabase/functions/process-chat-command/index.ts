// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-conversation-id',
};

// --- Helper functions ---
async function callGemini(prompt, apiKey, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
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

      if (geminiResponse.status === 503) {
        if (i < retries - 1) {
          console.warn(`Gemini API returned 503. Retrying in ${delay / 1000}s... (${i + 1}/${retries})`);
          await new Promise(res => setTimeout(res, delay));
          delay *= 2; // Exponential backoff
          continue;
        } else {
          throw new Error(`Gemini API error: The model is overloaded. Please try again later. (Status: 503)`);
        }
      }

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        throw new Error(`Gemini API error: ${geminiResponse.statusText} - ${errorText}`);
      }

      const geminiResult = await geminiResponse.json();
      const aiResponseText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!aiResponseText) throw new Error("Failed to get a valid response from Gemini.");
      
      try {
        return JSON.parse(aiResponseText);
      } catch (e) {
        console.error("Failed to parse Gemini JSON response:", aiResponseText);
        throw new Error(`JSON parsing error: ${e.message}`);
      }
    } catch (error) {
      if (i === retries - 1) throw error;
    }
  }
  throw new Error("Gemini API call failed after multiple retries.");
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

      let timer1, timer2;

      try {
        const { query } = await req.json();
        if (!query) throw new Error("Search query is required.");

        const conversationId = req.headers.get('x-conversation-id');

        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
        const userRes = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
        if (userRes.error) throw new Error("Authentication failed");
        const user = userRes.data.user;

        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
        if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY secret is not set.");

        const intentPrompt = `...`; // Omitted for brevity, no changes here
        const { intent, company_name } = await callGemini(intentPrompt, GEMINI_API_KEY);

        if (intent === 'find_contacts' && company_name) {
          // Contact finding logic remains the same
        } else {
          sendUpdate({ type: 'status', message: 'Deconstructing your request...' });
          const searchQueryPrompt = `...`; // Omitted for brevity, no changes here
          const { search_query, location, sites, recruiter_specialty } = await callGemini(searchQueryPrompt, GEMINI_API_KEY);
          
          sendUpdate({ type: 'status', message: `Searching for roles on ${sites}...` });
          
          const scrapingPromise = fetch(`https://coogi-jobspy-production.up.railway.app/jobs?query=${encodeURIComponent(search_query)}&location=${encodeURIComponent(location)}&sites=${sites}&results=100&enforce_annual_salary=true&hours_old=24`, { signal: AbortSignal.timeout(45000) });

          timer1 = setTimeout(() => sendUpdate({ type: 'status', message: 'This can take a moment. I\'m compiling results from all sources...' }), 8000);
          timer2 = setTimeout(() => sendUpdate({ type: 'status', message: 'Filtering out duplicates and irrelevant listings...' }), 16000);

          const scrapingResponse = await scrapingPromise;
          clearTimeout(timer1);
          clearTimeout(timer2);

          if (!scrapingResponse.ok) throw new Error(`Job scraping API failed: ${await scrapingResponse.text()}`);
          const rawJobResults = (await scrapingResponse.json())?.jobs;

          if (!rawJobResults || rawJobResults.length === 0) {
            sendUpdate({ type: 'result', payload: { text: "I couldn't find any open roles matching your request. Please try a different search." } });
            controller.close();
            return;
          }

          if (rawJobResults.length > 75) {
            sendUpdate({ type: 'result', payload: { text: `I found over ${rawJobResults.length} jobs. To help me focus, could you be more specific? For example, add a seniority level like "senior" or a company type like "startup".` } });
            controller.close();
            return;
          }

          sendUpdate({ type: 'status', message: `Found ${rawJobResults.length} potential jobs. Now preparing for analysis...` });
          
          const jobsToAnalyze = [...rawJobResults].sort((a, b) => (b.max_amount || 0) - (a.max_amount || 0));
          
          sendUpdate({ type: 'analysis_start', payload: { jobs: jobsToAnalyze.map(j => ({ company: j.company, title: j.title })) } });

          const enrichmentPromises = jobsToAnalyze.map((job, index) => (async () => {
            try {
              sendUpdate({ type: 'analysis_progress', payload: { index, status: 'analyzing' } });
              const jobHash = await createJobHash(job);
              const { data: cached } = await supabaseAdmin.from('job_analysis_cache').select('analysis_data').eq('job_hash', jobHash).single();
              let analysisData;
              if (cached) {
                  analysisData = cached.analysis_data;
              } else {
                  const singleEnrichmentPrompt = `...`; // Omitted for brevity, no changes here
                  analysisData = await callGemini(singleEnrichmentPrompt, GEMINI_API_KEY);
                  await supabaseAdmin.from('job_analysis_cache').insert({ job_hash: jobHash, analysis_data: analysisData });
              }
              analysisData.match_score = sanitizeMatchScore(analysisData.match_score || analysisData.matchScore);
              const { data: domainData } = await supabaseAdmin.functions.invoke('get-company-domain', { body: { companyName: analysisData.companyName || job.company } });
              analysisData.company_domain = domainData?.domain;
              sendUpdate({ type: 'analysis_progress', payload: { index, status: 'analyzed', match_score: analysisData.match_score } });
              return analysisData;
            } catch (e) {
              console.error(`Error enriching job at index ${index}:`, e.message);
              sendUpdate({ type: 'analysis_progress', payload: { index, status: 'error' } });
              return null;
            }
          })());

          const settledResults = await Promise.allSettled(enrichmentPromises);
          const enrichedOpportunities = settledResults.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
          let opportunitiesToReturn = enrichedOpportunities.filter(opp => opp.match_score >= 5).sort((a, b) => b.match_score - a.match_score);
          
          if (opportunitiesToReturn.length === 0) {
              if (enrichedOpportunities.length > 0) {
                  const rejectedJobsSummary = enrichedOpportunities.slice(0, 5).map(job => `- ${job.role} at ${job.companyName} (Score: ${job.match_score})`).join('\n');
                  const feedbackPrompt = `
                      You are a helpful AI recruiting assistant. A user searched for jobs matching the specialty: "${recruiter_specialty}".
                      You found and analyzed ${enrichedOpportunities.length} jobs, but none scored high enough to be considered a good match (all were below 5/10).
                      Here is a sample of the rejected jobs and their scores:
                      ${rejectedJobsSummary}
                      Based on this, provide a concise, helpful message to the user. Explain why these jobs might have been poor matches and suggest 2-3 specific ways they could refine their search query for better results. For example, suggest adding a seniority level (like 'senior', 'director'), a technology (like 'React'), or a more specific industry (like 'B2B SaaS' instead of just 'tech').
                      Keep the tone encouraging. Start with "I analyzed ${enrichedOpportunities.length} jobs, but they weren't a strong match for your specialty."
                      Return your response as a single valid JSON object with one key: "responseText".
                  `;
                  const feedbackResult = await callGemini(feedbackPrompt, GEMINI_API_KEY);
                  sendUpdate({ type: 'result', payload: { text: feedbackResult.responseText } });
              } else {
                  sendUpdate({ type: 'result', payload: { text: "I couldn't find any open roles matching your request. Please try a different search." } });
              }
              controller.close();
              return;
          }

          const opportunitiesToInsert = opportunitiesToReturn.map(opp => ({ /* ... */ })); // Omitted for brevity
          const { data: savedOpportunities, error: insertOppError } = await supabaseAdmin.from('opportunities').insert(opportunitiesToInsert).select();
          if (insertOppError) throw new Error(`Failed to save opportunities: ${insertOppError.message}`);

          const agentName = recruiter_specialty.length > 50 ? recruiter_specialty.substring(0, 47) + '...' : recruiter_specialty;
          const { data: newAgent, error: agentInsertError } = await supabaseAdmin.from('agents').insert({ /* ... */ }).select().single();
          if (!agentInsertError && newAgent) {
              sendUpdate({ type: 'agent_created', payload: { agentName: newAgent.name } });
              if (conversationId) { await supabaseAdmin.from('feed_items').insert({ /* ... */ }); }
          }

          let responseText = `I found ${savedOpportunities.length} potential deals for you. Here are the top matches.`;
          sendUpdate({ type: 'result', payload: { text: responseText, opportunities: savedOpportunities, searchParams: { recruiter_specialty } } });
        }
      } catch (error) {
        sendUpdate({ type: 'error', message: error.message });
      } finally {
        clearTimeout(timer1);
        clearTimeout(timer2);
        controller.close();
      }
    }
  });

  return new Response(stream, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
});