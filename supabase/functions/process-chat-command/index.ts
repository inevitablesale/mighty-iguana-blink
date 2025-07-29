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
        const { query } = await req.json();
        if (!query) throw new Error("Search query is required.");

        const conversationId = req.headers.get('x-conversation-id');

        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
        const userRes = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
        if (userRes.error) throw new Error("Authentication failed");
        const user = userRes.data.user;

        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
        if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY secret is not set.");

        // --- CONTEXT-AWARE INTENT DETECTION ---
        let hasPreviousResults = false;
        let previousOpportunities = [];
        let previousSearchParams = null;

        if (conversationId) {
          const { data: lastAiMessage } = await supabaseAdmin
            .from('feed_items')
            .select('content')
            .eq('conversation_id', conversationId)
            .eq('role', 'system')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (lastAiMessage && lastAiMessage.content?.opportunities?.length > 0) {
            hasPreviousResults = true;
            previousOpportunities = lastAiMessage.content.opportunities;
            previousSearchParams = lastAiMessage.content.searchParams;
          }
        }

        const intentPrompt = `
          You are an AI assistant that selects the correct action from a playbook based on a user's query.

          **ACTION PLAYBOOK (The Dictionary of Concepts):**
          
          **1. Discovery & Search:**
          - **find_opportunities**: For any new search for jobs, roles, or companies. (e.g., "Find me sales roles", "Show me fintechs hiring in NY")
          - **find_contacts**: To find people, employees, or specific roles at a named company. (e.g., "people at Google", "Who is the Head of Sales at Salesforce?")
          - **find_similar_opportunities**: To find jobs similar to a previous result. (e.g., "find more like the one at Acme Corp")

          **2. Analysis & Intelligence:**
          - **get_company_briefing**: For a detailed report on a company. (e.g., "give me a briefing on Microsoft", "tell me about Stripe")
          - **analyze_propensity_to_switch**: To assess if a company is likely to need external recruiters. (e.g., "how likely is Figma to use a recruiter?", "should I pitch to this company?")
          - **evaluate_contact_fit**: To score a specific person's relevance as a hiring manager. (e.g., "is John Doe a good contact for this role?")
          - **summarize_deal**: To get a summary of a specific opportunity. (e.g., "summarize the deal with Oracle")

          **3. Action & Outreach:**
          - **create_outreach_from_opportunity**: To generate a cold email draft for a specific opportunity and contact. (e.g., "draft an email to Jane Smith for the Oracle deal")
          - **generate_proposal**: To create a formal recruitment proposal for a campaign. (e.g., "create a proposal for the Oracle campaign")
          - **send_email**: To send a previously drafted email. (e.g., "ok, send that email")

          **4. Data Management & Refinement:**
          - **refine_results**: To filter, sort, or modify the immediately preceding list of opportunities. (e.g., "trim these to the top 3", "show me the best ones", "only show remote jobs")
          - **save_opportunity**: To save a specific opportunity to a list. (e.g., "save the Google opportunity")
          - **dismiss_opportunity**: To remove an opportunity from view. (e.g., "dismiss the one from Apple")
          - **create_campaign**: To manually create a new campaign from an opportunity. (e.g., "start a campaign for the Meta role")

          **5. Agent Management:**
          - **run_agent_by_name**: To manually trigger a saved agent to run. (e.g., "run my 'Fintech Sales' agent")
          - **list_my_agents**: To see a list of all saved agents. (e.g., "show me my agents")
          - **edit_agent**: To modify a saved agent. (e.g., "edit the 'Bay Area' agent")
          - **delete_agent**: To delete a saved agent. (e.g., "delete the 'Fintech' agent")
          - **pause_agent**: To temporarily stop an agent from running automatically. (e.g., "pause my main agent")
          - **resume_agent**: To resume a paused agent. (e.g., "resume the 'SaaS' agent")

          **6. Meta & Clarification:**
          - **clarify**: If the user's intent is ambiguous or doesn't fit other actions. (e.g., "what can you do?", "help")
          - **summarize_conversation**: To get a summary of the current chat. (e.g., "what have we talked about so far?")

          **User Query:** "${query}"
          **Context:** The last AI message ${hasPreviousResults ? 'contained a list of job opportunities' : 'did not contain a list of job opportunities'}.

          **Output Format:**
          Return a single, valid JSON object with the action and its parameters.
          Example for "trim to top 3": { "action": "refine_results", "parameters": { "refinement_type": "top_n", "value": 3 } }
          Example for "people at Google": { "action": "find_contacts", "parameters": { "company_name": "Google", "keywords": "" } }
          Example for "briefing on Microsoft": { "action": "get_company_briefing", "parameters": { "company_name": "Microsoft" } }
        `;
        
        const intent = await callGemini(intentPrompt, GEMINI_API_KEY);

        switch (intent.action) {
          case 'refine_results':
            if (!hasPreviousResults) {
              sendUpdate({ type: 'result', payload: { text: "There are no results to refine. Please start a new search." } });
              break;
            }
            sendUpdate({ type: 'status', message: 'Refining your previous results...' });
            
            let refinedOpportunities = [...previousOpportunities];
            refinedOpportunities.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));

            if (intent.parameters.refinement_type === 'top_n' && intent.parameters.value) {
              refinedOpportunities = refinedOpportunities.slice(0, intent.parameters.value);
            }
            
            if (refinedOpportunities.length > 0) {
              sendUpdate({ type: 'result', payload: { text: `Here are the top ${refinedOpportunities.length} opportunities from your last search.`, opportunities: refinedOpportunities, searchParams: previousSearchParams } });
            } else {
              sendUpdate({ type: 'result', payload: { text: "I couldn't refine the results as requested. Please try a new search." } });
            }
            break;

          case 'find_contacts':
            const { company_name, keywords } = intent.parameters;
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
            break;

          case 'find_opportunities':
            sendUpdate({ type: 'status', message: 'Deconstructing your request...' });
            const searchQueryPrompt = `
              You are an AI recruiting analyst. Break down the query into structured parameters.

              User Query: "${query}"

              Return a JSON object with the following structure. Be thorough.
              {
                "search_query": "The core job title or skills to search for. E.g., 'senior sales roles'",
                "location": "The city, state, or country. E.g., 'New York'",
                "recruiter_specialty": "A concise summary of the recruiter's focus. E.g., 'Sales placements in SaaS'"
              }
            `;
            const { search_query, location, recruiter_specialty } = await callGemini(searchQueryPrompt, GEMINI_API_KEY);
            
            const agentName = recruiter_specialty.length > 50 ? recruiter_specialty.substring(0, 47) + '...' : recruiter_specialty;
            const { data: newAgent, error: agentInsertError } = await supabaseAdmin.from('agents').insert({
              user_id: user.id, name: agentName, prompt: recruiter_specialty, autonomy_level: 'semi-automatic',
              site_names: ["linkedin", "indeed", "zip_recruiter", "google"], max_results: 20, search_lookback_hours: 72,
            }).select().single();

            if (!agentInsertError && newAgent) {
                sendUpdate({ type: 'agent_created', payload: { agentName: newAgent.name } });
            }

            sendUpdate({ type: 'status', message: `Searching for roles...` });
            
            const scrapingResponse = await fetch(`https://coogi-jobspy-production.up.railway.app/jobs?query=${encodeURIComponent(search_query)}&location=${encodeURIComponent(location)}&sites=linkedin,indeed,zip_recruiter,google&results=150&enforce_annual_salary=true&hours_old=24`, { signal: AbortSignal.timeout(60000) });
            if (!scrapingResponse.ok) throw new Error(`Job scraping API failed: ${await scrapingResponse.text()}`);
            const rawJobResults = (await scrapingResponse.json())?.jobs;

            if (!rawJobResults || rawJobResults.length === 0) {
              sendUpdate({ type: 'result', payload: { text: "I couldn't find any open roles matching your request. Please try a different search." } });
              break;
            }

            const uniqueJobsMap = new Map();
            rawJobResults.forEach(job => {
                const key = `${job.company?.trim().toLowerCase()}|${job.title?.trim().toLowerCase()}`;
                if (!uniqueJobsMap.has(key)) uniqueJobsMap.set(key, job);
            });
            const jobsToAnalyze = Array.from(uniqueJobsMap.values());

            let finalJobsToAnalyze = jobsToAnalyze.sort((a, b) => (b.max_amount || 0) - (a.max_amount || 0)).slice(0, 75);
            
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
                        "companyName": "...", "role": "...", "location": "...", "match_score": 1–10,
                        "contract_likelihood": "High" | "Low", "likely_contract_type": "Contingency" | "RPO",
                        "ta_team_status": "None" | "Lean" | "Healthy", "comp_band": "$120K–$160K",
                        "urgency_signals": ["Backfill", "Product Launch"], "recruiter_pitch": "...",
                        "decision_maker_title": "Chief Revenue Officer"
                      }
                    `;
                    analysisData = await callGemini(singleEnrichmentPrompt, GEMINI_API_KEY);
                    await supabaseAdmin.from('job_analysis_cache').insert({ job_hash: jobHash, analysis_data: analysisData });
                }
                
                analysisData.match_score = sanitizeMatchScore(analysisData.match_score);
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
                  }
                }
                sendUpdate({ type: 'analysis_progress', payload: { index, status: 'analyzed', match_score: analysisData.match_score } });
              } catch (e) {
                console.error(`Error enriching job at index ${index}:`, e.message);
                sendUpdate({ type: 'analysis_progress', payload: { index, status: 'error' } });
              }
            }
            
            if (successfulOpportunities.length > 0) {
              sendUpdate({ type: 'result', payload: { text: `I found ${successfulOpportunities.length} potential deals.`, opportunities: successfulOpportunities, searchParams: { recruiter_specialty } } });
            } else {
              sendUpdate({ type: 'result', payload: { text: "Analysis complete, but no strong matches found." } });
            }
            break;

          default: // 'clarify' or unknown
            sendUpdate({ type: 'result', payload: { text: "I'm not sure how to handle that. Could you please rephrase? You can ask me to find opportunities or find contacts at a specific company." } });
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