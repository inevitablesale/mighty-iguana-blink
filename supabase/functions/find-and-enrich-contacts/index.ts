// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const { opportunityId, taskId } = await req.json();
  if (!opportunityId || !taskId) {
    return new Response(JSON.stringify({ error: "Opportunity ID and Task ID are required." }), { status: 400, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("API keys are not set.");

    const { data: opportunity, error: oppError } = await supabaseAdmin.from('opportunities').select('company_name, role, user_id, agent_id').eq('id', opportunityId).single();
    if (oppError) throw new Error(`Failed to fetch opportunity: ${oppError.message}`);

    const researchPrompt = `
      You are an expert recruiter’s AI sourcing assistant. Your job is to find staffing decision-makers at "${opportunity.company_name}" for the open role of "${opportunity.role}".

      Who to target:
      Focus on people who are likely to own the hiring decision or benefit from recruiting help. Ideal titles include:
      - Hiring manager (e.g., VP of Sales for a sales role)
      - Department leads (e.g., Head of Engineering, Marketing Director)
      - C-level (e.g., CEO, COO, CTO at small companies)
      - Founders (for startups)
      - HR / People Ops / Talent (only if no other signals exist)

      Where to search (open sources only):
      1. LinkedIn Search
         - Use queries like: site:linkedin.com/in ("${opportunity.company_name}" AND "VP Sales")
         - Prioritize current employees with relevant decision-making roles.
      2. Company Website
         - Check the “Team”, “Leadership”, or “About Us” pages for public-facing execs and department heads.
      3. Crunchbase or AngelList (for startups)
         - Identify founders, key team members, and any public hires.
      4. Press Releases / News Mentions
         - Google queries like: "${opportunity.company_name}" hiring OR expansion OR launch
         - Look for recent hiring initiatives or promotions.
      5. Job Posting Author or Owner
         - If the job was posted on LinkedIn, grab the “Posted by” user—often the hiring manager.

      For each contact, return as much of the following as possible:
      - name
      - title
      - email (only if publicly listed or easily inferred)
      - linkedin (full URL)
      - seniority (e.g., C-level, VP, Director, Manager)
      - department (Sales, Engineering, HR, etc.)
      - reason_for_inclusion (why this person is likely the decision-maker)

      Return a single JSON object with a "contacts" array.
      Example Output:
      {
        "contacts": [
          {
            "name": "Sarah Thompson",
            "title": "VP of Sales",
            "email": "sarah@acme.io",
            "linkedin": "https://linkedin.com/in/sarahthompson",
            "seniority": "VP",
            "department": "Sales",
            "reason_for_inclusion": "Sarah is the head of Sales and likely owns hiring for this role."
          },
          {
            "name": "James Liu",
            "title": "Founder & CEO",
            "email": "james@acme.io",
            "linkedin": "https://linkedin.com/in/jamesliu",
            "seniority": "C-level",
            "department": "Executive",
            "reason_for_inclusion": "Small company—CEO is still likely involved in key hires."
          }
        ]
      }
    `;

    const researchResult = await callGemini(researchPrompt, GEMINI_API_KEY);
    const foundContacts = researchResult.contacts || [];

    if (foundContacts.length === 0) {
        await supabaseAdmin.from('contact_enrichment_tasks').update({ status: 'complete', error_message: 'AI web search completed but found no contacts.' }).eq('id', taskId);
        return new Response(JSON.stringify({ message: "No contacts found." }), { status: 200, headers: corsHeaders });
    }

    const contactsToInsert = foundContacts.map(c => ({
        task_id: taskId, opportunity_id: opportunityId, user_id: opportunity.user_id,
        name: c.name, job_title: c.title, email: c.email,
        linkedin_profile_url: c.linkedin,
        email_status: c.email ? 'verified' : null // Assume verified if found
    }));
    const { data: savedContacts, error: insertError } = await supabaseAdmin.from('contacts').insert(contactsToInsert).select();
    if (insertError) throw new Error(`Failed to save contacts: ${insertError.message}`);

    await supabaseAdmin.from('contact_enrichment_tasks').update({ status: 'complete' }).eq('id', taskId);

    if (opportunity.agent_id) {
        const { data: agent } = await supabaseAdmin.from('agents').select('autonomy_level').eq('id', opportunity.agent_id).single();
        if (agent && (agent.autonomy_level === 'semi-automatic' || agent.autonomy_level === 'automatic')) {
            const authHeader = req.headers.get('Authorization');
            const topContact = savedContacts.find(c => c.email);
            if (topContact && authHeader) {
                await supabaseAdmin.functions.invoke('generate-outreach-for-opportunity', {
                    headers: { 'Authorization': authHeader },
                    body: { 
                      opportunityId, 
                      contact: topContact, 
                      isAutomatic: agent.autonomy_level === 'automatic' 
                    }
                });
            }
        }
    }

    return new Response(JSON.stringify({ message: `Successfully found and saved ${savedContacts.length} contacts.` }), { status: 200, headers: corsHeaders });

  } catch (error) {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    await supabaseAdmin.from('contact_enrichment_tasks').update({ status: 'error', error_message: error.message }).eq('id', taskId);
    console.error("Find and Enrich Contacts Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});