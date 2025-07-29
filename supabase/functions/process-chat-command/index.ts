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

        const intentPrompt = `
          You are an AI recruiter assistant specializing in contract acquisition. Your goal is to classify the user's goal.

          Query: "${query}"

          Return a JSON object with the following structure:
          - "intent": Must be one of ["find_opportunities", "find_contacts"].
          - If intent is "find_contacts", you MUST also return "company_name" and "keywords". "keywords" should be a string of job titles or roles mentioned. If no specific role is mentioned, return an empty string for keywords.

          Examples:
          - Query: "Find me sales roles at Series A companies"
            → { "intent": "find_opportunities", "company_name": null, "keywords": null }

          - Query: "Who’s the Head of Sales at Salesforce?"
            → { "intent": "find_contacts", "company_name": "Salesforce", "keywords": "Head of Sales" }
            
          - Query: "Show me people who work at Google"
            → { "intent": "find_contacts", "company_name": "Google", "keywords": "" }
        `;
        const { intent, company_name, keywords } = await callGemini(intentPrompt, GEMINI_API_KEY);

        if (intent === 'find_contacts' && company_name) {
          sendUpdate({ type: 'status', message: `Searching for contacts at ${company_name}...` });
          
          const { data: contactsData, error: contactsError } = await supabaseAdmin.functions.invoke('find-linkedin-contacts-by-company', {
            body: { companyName: company_name, keywords: keywords || '' }
          });

          if (contactsError) throw new Error(contactsError.message);

          const { contacts, message } = contactsData;

          if (!contacts || contacts.length === 0) {
            const responseText = message || `I couldn't find any contacts at ${company_name} matching your criteria.`;
            sendUpdate({ type: 'result', payload: { text: responseText } });
          } else {
            let responseText = `I found ${contacts.length} contacts at ${company_name}. Here are the results:`;
            if (keywords) {
              responseText += `\n\n(Note: Keyword filtering is temporarily disabled, so I'm showing all contacts I found for this company.)`;
            }
            sendUpdate({ type: 'result', payload: { text: responseText, contacts: contacts } });
          }

        } else {
          sendUpdate({ type: 'status', message: 'Deconstructing your request...' });
          const searchQueryPrompt = `
            You are an AI recruiting analyst. Break down the query into structured parameters.

            User Query: "${query}"

            Return a JSON object with the following structure. Be thorough.
            {
              "search_query": "The core job title or skills to search for. E.g., 'senior sales roles'",
              "location": "The city, state, or country. E.g., 'New York'",
              "industry": "The company's industry. E.g., 'B2B SaaS'",
              "seniority": "The seniority level. E.g., 'Senior'",
              "recruiter_specialty": "A concise summary of the recruiter's focus. E.g., 'Sales placements in SaaS'",
              "contractability_tags": ["An array of tags indicating contract viability. E.g., 'enterprise GTM', 'series B startup', 'urgent hire', 'no TA team'"],
              "target_contact_role": "The ideal job title of the person to contact. E.g., 'VP of Sales'"
            }
          `;
          const { search_query, location, sites, recruiter_specialty } = await callGemini(searchQueryPrompt, GEMINI_API_KEY);
          
          const agentName = recruiter_specialty.length > 50 ? recruiter_specialty.substring(0, 47) + '...' : recruiter_specialty;
          const { data: newAgent, error: agentInsertError } = await supabaseAdmin.from('agents').insert({
            user_id: user.id,
            name: agentName,
            prompt: recruiter_specialty,
            autonomy_level: 'semi-automatic',
            site_names: sites || ["linkedin", "indeed", "zip_recruiter", "google"],
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

          sendUpdate({ type: 'status', message: `Searching for roles on ${sites || 'major job boards'}...` });
          
          const scrapingPromise = fetch(`https://coogi-jobspy-production.up.railway.app/jobs?query=${encodeURIComponent(search_query)}&location=${encodeURIComponent(location)}&sites=${sites || 'linkedin,indeed,zip_recruiter,google'}&results=150&enforce_annual_salary=true&hours_old=24`, { signal: AbortSignal.timeout(60000) });

          const scrapingResponse = await scrapingPromise;

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

          const successfulOpportunities = [];

          for (const [index, job] of finalJobsToAnalyze.entries()) {
            try {
              sendUpdate({ type: 'analysis_progress', payload: { index, status: 'analyzing' } });
              const jobHash = await createJobHash(job);
              const { data: cached } = await supabaseAdmin.from('job_analysis_cache').select('analysis_data').eq('job_hash', jobHash).single();
              let analysisData;
              if (cached) {
                  analysisData = cached.analysis_data;
              } else {
                  const singleEnrichmentPrompt = `
                    You are a contract recruiter assistant. Analyze the job below.

                    Input:
                    - Specialty: "${recruiter_specialty}"
                    - Job: ${JSON.stringify(job)}

                    Return JSON:
                    {
                      "companyName": "...",
                      "role": "...",
                      "location": "...",
                      "match_score": 1–10,
                      "contract_likelihood": "High" | "Low",
                      "likely_contract_type": "Contingency" | "RPO" | "Freelance" | "Embedded",
                      "ta_team_status": "None" | "Lean" | "Healthy" | "Unknown",
                      "comp_band": "$120K–$160K",
                      "urgency_signals": ["Backfill", "Product Launch", "Investor Pressure"],
                      "recruiter_pitch": "Looks like this VP of Sales role has no recruiter assigned and is tied to recent product push—great time to reach out.",
                      "decision_maker_title": "Chief Revenue Officer"
                    }
                  `;
                  analysisData = await callGemini(singleEnrichmentPrompt, GEMINI_API_KEY);
                  await supabaseAdmin.from('job_analysis_cache').insert({ job_hash: jobHash, analysis_data: analysisData });
              }
              analysisData.match_score = sanitizeMatchScore(analysisData.match_score || analysisData.matchScore);
              
              if (analysisData.match_score >= 5) {
                const { data: domainData } = await supabaseAdmin.functions.invoke('get-company-domain', { body: { companyName: analysisData.companyName || job.company } });
                
                const opportunityToInsert = {
                  user_id: user.id,
                  company_name: analysisData.companyName,
                  role: analysisData.role,
                  location: analysisData.location,
                  company_overview: analysisData.company_overview,
                  match_score: analysisData.match_score,
                  contract_value_assessment: analysisData.comp_band || analysisData.contract_value_assessment,
                  hiring_urgency: Array.isArray(analysisData.urgency_signals) ? analysisData.urgency_signals.join(', ') : analysisData.hiring_urgency,
                  pain_points: analysisData.pain_points,
                  recruiter_angle: analysisData.recruiter_pitch || analysisData.recruiter_angle,
                  key_signal_for_outreach: analysisData.key_signal_for_outreach,
                  company_domain: domainData?.domain,
                  ta_team_status: analysisData.ta_team_status,
                  likely_decision_maker: analysisData.decision_maker_title,
                };

                const { data: savedOpportunity, error: insertError } = await supabaseAdmin.from('opportunities').insert(opportunityToInsert).select().single();
                if (insertError) throw new Error(`Failed to save opportunity: ${insertError.message}`);
                
                if (savedOpportunity) {
                  successfulOpportunities.push(savedOpportunity);
                  sendUpdate({ type: 'opportunity_found', payload: savedOpportunity });
                }
              }

              sendUpdate({ type: 'analysis_progress', payload: { index, status: 'analyzed', match_score: analysisData.match_score } });
            } catch (e) {
              console.error(`Error enriching job at index ${index}:`, e.message);
              sendUpdate({ type: 'analysis_progress', payload: { index, status: 'error' } });
            }
          }
          
          if (successfulOpportunities.length === 0) {
              sendUpdate({ type: 'result', payload: { text: "I analyzed all the jobs, but none were a strong enough fit to recommend. Please try a more specific search." } });
          } else {
              let responseText = `I found ${successfulOpportunities.length} potential deals for you. Here are the top matches.`;
              if (resultWarning) {
                  responseText = `${resultWarning}\n\n${responseText}`;
              }
              sendUpdate({ type: 'result', payload: { text: responseText, searchParams: { recruiter_specialty }, opportunities: successfulOpportunities } });
          }
        }
      } catch (error) {
        sendUpdate({ type: 'error', message: error.message });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
});