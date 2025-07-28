// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
        const userRes = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
        if (userRes.error) throw new Error("Authentication failed");
        const user = userRes.data.user;

        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
        if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY secret is not set.");

        // Step 1: Classify Intent
        const intentPrompt = `
          Classify the user's intent. Is the user asking to "find new opportunities" or to "find contacts" for a company they mention?
          User Query: "${query}"
          Return a JSON object with "intent" (either "find_opportunities" or "find_contacts") and, if the intent is "find_contacts", a "company_name".
          If the user is just making a general statement or asking a question, default the intent to "find_opportunities".
        `;
        const { intent, company_name } = await callGemini(intentPrompt, GEMINI_API_KEY);

        if (intent === 'find_contacts' && company_name) {
          // --- CONTACT FINDING LOGIC ---
          sendUpdate({ type: 'status', message: `Understood. Looking for the latest opportunity for "${company_name}"...` });

          const { data: opportunity, error: oppError } = await supabaseAdmin
            .from('opportunities')
            .select('id, user_id')
            .eq('user_id', user.id)
            .eq('company_name', company_name)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (oppError || !opportunity) {
            throw new Error(`I couldn't find a recent opportunity for "${company_name}". Please try searching for opportunities first.`);
          }

          sendUpdate({ type: 'status', message: `Found opportunity. Kicking off contact search...` });

          const { data: task, error: taskError } = await supabaseAdmin
            .from('contact_enrichment_tasks')
            .insert({ user_id: user.id, opportunity_id: opportunity.id, company_name: company_name, status: 'pending' })
            .select('id')
            .single();

          if (taskError) throw new Error(`Failed to create contact search task: ${taskError.message}`);

          supabaseAdmin.functions.invoke('find-and-enrich-contacts', {
            headers: { 'Authorization': req.headers.get('Authorization') },
            body: { opportunityId: opportunity.id, taskId: task.id }
          });

          sendUpdate({ type: 'result', payload: { text: `I've started the search for contacts at ${company_name}. You can see the results on the deal page for this opportunity shortly.` } });

        } else {
          // --- EXISTING OPPORTUNITY FINDING LOGIC ---
          sendUpdate({ type: 'status', message: 'Deconstructing your request...' });
          const searchQueryPrompt = `
            Analyze the user's search query to extract structured search parameters.
            User Query: "${query}"
            Available sites are: linkedin, indeed, zip_recruiter, glassdoor, google, bayt, naukri.
            For most professional roles in the US or Europe, use 'linkedin,indeed,zip_recruiter,glassdoor,google'. If it mentions India, include 'naukri'. If it mentions the Middle East, include 'bayt'.
            If no specific location is mentioned, default the location to "Remote".
            Also, create a concise "recruiter_specialty" string that summarizes the user's intent (e.g., "placing senior engineers in high-growth B2B software companies"). This will be used for analysis.
            Return ONLY a single, valid JSON object with keys: "search_query", "location", "sites", and "recruiter_specialty".
          `;
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

          sendUpdate({ type: 'status', message: `Found ${rawJobResults.length} potential jobs. Now filtering and preparing for analysis...` });

          const sortedJobs = rawJobResults.filter(job => job.max_amount && job.max_amount > 0).sort((a, b) => b.max_amount - a.max_amount);
          const topJobs = sortedJobs.slice(0, 20);
          
          sendUpdate({
            type: 'analysis_start',
            payload: {
              jobs: topJobs.map(j => ({ company: j.company, title: j.title }))
            }
          });

          const enrichedOpportunities = [];
          for (const [index, job] of topJobs.entries()) {
              try {
                  const jobHash = await createJobHash(job);
                  const { data: cached } = await supabaseAdmin.from('job_analysis_cache').select('analysis_data').eq('job_hash', jobHash).single();
                  
                  let analysisData;
                  if (cached) {
                      analysisData = cached.analysis_data;
                  } else {
                      const singleEnrichmentPrompt = `
                          You are a world-class recruiting strategist. Analyze the following job posting based on a recruiter's stated specialty.
                          Recruiter's specialty: "${recruiter_specialty}"
                          Job Posting: ${JSON.stringify(job)}
                          Return a single, valid JSON object with keys: "companyName", "role", "location", "company_overview", "match_score", "contract_value_assessment", "hiring_urgency", "pain_points", "recruiter_angle", "key_signal_for_outreach".
                          **The "match_score" MUST be an integer between 1 and 10.**
                          **For "contract_value_assessment", analyze the job description for salary information. If a salary range is found (e.g., $100k - $120k), calculate the average salary ($110k), take 20% of that to estimate the placement fee ($22k), and return a string like 'Est. Fee: $22,000'. If no salary is found, provide a qualitative assessment like 'High Value' or 'Medium Value'.**
                          **Crucially, ensure that any double quotes within the string values of the final JSON are properly escaped with a backslash (e.g., "some \\"quoted\\" text").**
                      `;
                      analysisData = await callGemini(singleEnrichmentPrompt, GEMINI_API_KEY);
                      await supabaseAdmin.from('job_analysis_cache').insert({ job_hash: jobHash, analysis_data: analysisData });
                  }
                  
                  analysisData.match_score = sanitizeMatchScore(analysisData.match_score || analysisData.matchScore);
                  analysisData.linkedin_url_slug = extractLinkedInSlug(job.company_linkedin_url);
                  enrichedOpportunities.push(analysisData);

                  sendUpdate({
                    type: 'analysis_progress',
                    payload: {
                      index: index,
                      match_score: analysisData.match_score
                    }
                  });

              } catch (e) {
                  console.error(`Failed to enrich job for ${job.company}: ${e.message}`);
              }
          }

          let opportunitiesToReturn = enrichedOpportunities.filter(opp => opp.match_score >= 5).sort((a, b) => b.match_score - a.match_score);
          
          if (opportunitiesToReturn.length === 0) {
              sendUpdate({ type: 'result', payload: { text: "I analyzed the jobs I found, but none were a strong match for your specialty. Try broadening your search." } });
              controller.close();
              return;
          }

          let responseText = `I found ${opportunitiesToReturn.length} potential deals for you. Here are the top matches. You can now find contacts or create an agent to automate this search.`;

          sendUpdate({ type: 'status', message: 'Finalizing results...' });

          const opportunitiesToInsert = opportunitiesToReturn.map(opp => ({
              user_id: user.id,
              company_name: opp.companyName || opp.company_name,
              role: opp.role,
              location: opp.location || 'N/A',
              company_overview: opp.company_overview || 'N/A',
              match_score: opp.match_score,
              contract_value_assessment: opp.contract_value_assessment || 'N/A',
              hiring_urgency: opp.hiring_urgency || 'N/A',
              pain_points: opp.pain_points || 'N/A',
              recruiter_angle: opp.recruiter_angle || 'N/A',
              key_signal_for_outreach: opp.key_signal_for_outreach || 'N/A',
              linkedin_url_slug: opp.linkedin_url_slug || null,
          }));

          const { data: savedOpportunities, error: insertOppError } = await supabaseAdmin.from('opportunities').insert(opportunitiesToInsert).select();
          if (insertOppError) throw new Error(`Failed to save opportunities: ${insertOppError.message}`);

          sendUpdate({ type: 'result', payload: { text: responseText, opportunities: savedOpportunities, searchParams: { recruiter_specialty } } });
        }
        
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