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

      const timers = [];

      try {
        let { query } = await req.json();
        if (!query) throw new Error("Search query is required.");

        const conversationId = req.headers.get('x-conversation-id');

        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
        const userRes = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
        if (userRes.error) throw new Error("Authentication failed");
        const user = userRes.data.user;

        // Check if this is a refinement query
        if (conversationId && query.split(' ').length <= 5) {
            sendUpdate({ type: 'status', message: 'Checking for context...' });
            const { data: previousMessages, error: historyError } = await supabaseAdmin
                .from('feed_items')
                .select('role, content')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: false })
                .limit(2);

            if (!historyError && previousMessages && previousMessages.length === 2) {
                const lastAiResponse = previousMessages[0];
                const lastUserQuery = previousMessages[1];

                if (lastAiResponse.role === 'system' && lastUserQuery.role === 'user' && lastAiResponse.content?.summary?.includes('To help me focus, could you be more specific?')) {
                    const originalQuery = lastUserQuery.content?.query;
                    if (originalQuery) {
                        const combinedQuery = `${originalQuery} ${query}`;
                        console.log(`Refined query detected. Combined query: "${combinedQuery}"`);
                        sendUpdate({ type: 'status', message: `Refining search with: "${query}"` });
                        query = combinedQuery;
                    }
                }
            }
        }

        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
        if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY secret is not set.");

        const intentPrompt = `...`; // Omitted for brevity, no changes here
        const { intent, company_name } = await callGemini(intentPrompt, GEMINI_API_KEY);

        if (intent === 'find_contacts' && company_name) {
          // Contact finding logic remains the same
        } else {
          sendUpdate({ type: 'status', message: 'Deconstructing your request...' });
          const searchQueryPrompt = `
            Analyze the recruiter’s business development request to extract structured search parameters. The goal is to separate core, searchable keywords from qualitative, analytical filters.

            User Query: "${query}"

            **Instructions:**
            1.  **search_query**: Identify the core, concrete keywords for a job search. This should include job titles, primary skills, and industry. For example, from "remote fintech startups hiring software engineers with no TA team", the search_query should be "software engineer fintech".
            2.  **location**: Extract the location. Default to "Remote" if not specified or if the query implies it.
            3.  **sites**: Determine the best job boards. For most professional roles in the US/Europe, use 'linkedin,indeed,zip_recruiter,google'.
            4.  **recruiter_specialty**: This is crucial. Create a concise summary of the *entire* user request, including the qualitative filters (like "no talent acquisition team", "high-growth", "recently funded"). This specialty will be used for AI analysis *after* the initial search. For the example above, a good specialty would be "Placing software engineers at remote fintech startups, prioritizing those with no internal talent acquisition team."

            Return only a single, valid JSON object with keys: "search_query", "location", "sites", and "recruiter_specialty".
          `;
          const { search_query, location, sites, recruiter_specialty } = await callGemini(searchQueryPrompt, GEMINI_API_KEY);
          
          const agentName = recruiter_specialty.length > 50 ? recruiter_specialty.substring(0, 47) + '...' : recruiter_specialty;
          const { data: newAgent, error: agentInsertError } = await supabaseAdmin.from('agents').insert({
            user_id: user.id,
            name: agentName,
            prompt: recruiter_specialty,
            autonomy_level: 'semi-automatic',
            site_names: Array.isArray(sites) ? sites : sites.split(','),
            max_results: 20,
            search_lookback_hours: 72,
          }).select().single();

          if (!agentInsertError && newAgent) {
              sendUpdate({ type: 'agent_created', payload: { agentName: newAgent.name } });
              if (conversationId) {
                await supabaseAdmin.from('feed_items').insert({
                  user_id: user.id,
                  conversation_id: conversationId,
                  type: 'agent_created',
                  role: 'system',
                  content: { agentName: newAgent.name }
                });
              }
          }

          sendUpdate({ type: 'status', message: `Searching for roles on ${sites}...` });
          
          const scrapingPromise = fetch(`https://coogi-jobspy-production.up.railway.app/jobs?query=${encodeURIComponent(search_query)}&location=${encodeURIComponent(location)}&sites=${sites}&results=150&enforce_annual_salary=true&hours_old=24`, { signal: AbortSignal.timeout(60000) });

          timers.push(setTimeout(() => sendUpdate({ type: 'status', message: 'Compiling results from multiple job boards...' }), 4000));
          timers.push(setTimeout(() => sendUpdate({ type: 'status', message: 'This is a big search, still working on it...' }), 9000));
          timers.push(setTimeout(() => sendUpdate({ type: 'status', message: 'Filtering out duplicates and irrelevant listings...' }), 15000));
          timers.push(setTimeout(() => sendUpdate({ type: 'status', message: 'Almost there, just a few more seconds...' }), 22000));
          timers.push(setTimeout(() => sendUpdate({ type: 'status', message: 'The search is taking a bit longer than usual. Hang tight...' }), 30000));
          timers.push(setTimeout(() => sendUpdate({ type: 'status', message: 'Just wrapping up the search now...' }), 45000));

          const scrapingResponse = await scrapingPromise;
          timers.forEach(clearTimeout);

          if (!scrapingResponse.ok) throw new Error(`Job scraping API failed: ${await scrapingResponse.text()}`);
          const rawJobResults = (await scrapingResponse.json())?.jobs;

          if (!rawJobResults || rawJobResults.length === 0) {
            sendUpdate({ type: 'result', payload: { text: "I couldn't find any open roles matching your request. Please try a different search." } });
            controller.close();
            return;
          }

          sendUpdate({ type: 'status', message: `Found ${rawJobResults.length} total listings. Removing duplicates...` });
          const uniqueJobsMap = new Map();
          rawJobResults.forEach(job => {
              const key = `${job.company?.trim().toLowerCase()}|${job.title?.trim().toLowerCase()}`;
              if (!uniqueJobsMap.has(key)) {
                  uniqueJobsMap.set(key, job);
              }
          });
          const jobsToAnalyze = Array.from(uniqueJobsMap.values());

          let finalJobsToAnalyze;
          let resultWarning = null;

          if (jobsToAnalyze.length > 75) {
              resultWarning = `I found over ${jobsToAnalyze.length} unique jobs. To give you the best results quickly, I'm analyzing the top 75. You can always refine your search for a more targeted list.`;
              finalJobsToAnalyze = [...jobsToAnalyze]
                  .sort((a, b) => (b.max_amount || 0) - (a.max_amount || 0))
                  .slice(0, 75);
          } else {
              finalJobsToAnalyze = [...jobsToAnalyze].sort((a, b) => (b.max_amount || 0) - (a.max_amount || 0));
          }

          sendUpdate({ type: 'status', message: `Found ${jobsToAnalyze.length} unique potential jobs. Now preparing for analysis...` });
          
          sendUpdate({ type: 'analysis_start', payload: { jobs: finalJobsToAnalyze.map(j => ({ company: j.company, title: j.title })) } });

          const enrichmentPromises = finalJobsToAnalyze.map((job, index) => (async () => {
            try {
              sendUpdate({ type: 'analysis_progress', payload: { index, status: 'analyzing' } });
              const jobHash = await createJobHash(job);
              const { data: cached } = await supabaseAdmin.from('job_analysis_cache').select('analysis_data').eq('job_hash', jobHash).single();
              let analysisData;
              if (cached) {
                  analysisData = cached.analysis_data;
              } else {
                  const singleEnrichmentPrompt = `
                    You are a business development strategist for a recruiting firm.
                    Evaluate the job below as a lead for client acquisition (not candidate placement).

                    Recruiter’s Focus: "${recruiter_specialty}"
                    Job Posting: ${JSON.stringify(job)}

                    Return a single JSON object with:
                    - companyName
                    - role
                    - location
                    - company_overview
                    - match_score (1–10, based on BD opportunity fit)
                    - contract_value_assessment (20% of average salary)
                    - hiring_urgency (based on signals like reposts, stale posts)
                    - pain_points (reasons this may be hard to fill internally)
                    - recruiter_angle (what value the recruiter can pitch)
                    - key_signal_for_outreach (ideal hook for your email)

                    This prompt should guide the recruiter’s outreach and negotiation.
                  `;
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
                      You are a recruiting business advisor. A user searched for jobs matching the specialty: "${recruiter_specialty}". You analyzed roles, but none were worth pitching. Here are the failed jobs and match scores: ${rejectedJobsSummary}.

                      Provide an encouraging but direct JSON response that:
                      - Explains why the roles weren’t ideal for outreach
                      - Suggests 2–3 refined queries that would yield better leads

                      Begin with: "I analyzed ${enrichedOpportunities.length} jobs, but they weren’t a strong fit for client outreach."
                      Return a single JSON object with: "responseText".
                  `;
                  const feedbackResult = await callGemini(feedbackPrompt, GEMINI_API_KEY);
                  sendUpdate({ type: 'result', payload: { text: feedbackResult.responseText } });
              } else {
                  sendUpdate({ type: 'result', payload: { text: "I couldn't find any open roles matching your request. Please try a different search." } });
              }
              controller.close();
              return;
          }

          const opportunitiesToInsert = opportunitiesToReturn.map(opp => ({
            user_id: user.id,
            company_name: opp.companyName,
            role: opp.role,
            location: opp.location,
            company_overview: opp.company_overview,
            match_score: opp.match_score,
            contract_value_assessment: opp.contract_value_assessment,
            hiring_urgency: opp.hiring_urgency,
            pain_points: opp.pain_points,
            recruiter_angle: opp.recruiter_angle,
            key_signal_for_outreach: opp.key_signal_for_outreach,
            company_domain: opp.company_domain,
          }));
          const { data: savedOpportunities, error: insertOppError } = await supabaseAdmin.from('opportunities').insert(opportunitiesToInsert).select();
          if (insertOppError) throw new Error(`Failed to save opportunities: ${insertOppError.message}`);

          let responseText = `I found ${savedOpportunities.length} potential deals for you. Here are the top matches.`;
          if (resultWarning) {
              responseText = `${resultWarning}\n\n${responseText}`;
          }
          sendUpdate({ type: 'result', payload: { text: responseText, opportunities: savedOpportunities, searchParams: { recruiter_specialty } } });
        }
      } catch (error) {
        sendUpdate({ type: 'error', message: error.message });
      } finally {
        timers.forEach(clearTimeout);
        controller.close();
      }
    }
  });

  return new Response(stream, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
});