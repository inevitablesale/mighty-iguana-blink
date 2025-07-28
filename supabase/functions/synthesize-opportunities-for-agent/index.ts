// @ts-nocheck
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { opportunities } = await req.json();
    if (!opportunities || opportunities.length === 0) {
      throw new Error("At least one opportunity is required to synthesize a prompt.");
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set.");
    }

    const prompt = `
      You are an expert recruiting strategist. Analyze the following list of job opportunities and synthesize a concise, high-level "recruiter specialty" prompt that encapsulates the common themes. This prompt will be used to create an automated agent to find similar roles.

      **Job Opportunities:**
      ${JSON.stringify(opportunities.map(o => ({ role: o.role, company: o.company_name, overview: o.company_overview })), null, 2)}

      **Instructions:**
      1.  Identify the core job functions, seniority levels, industries, and company types.
      2.  Create a single, descriptive string that a recruiter would use to describe their niche.
      3.  Focus on the commonalities. If there are diverse roles, find the highest common denominator (e.g., "senior technical roles" instead of listing every single title).

      **Example Output:**
      If the opportunities are for a "VP of Sales at a Fintech startup" and a "Sales Director at a B2B SaaS company", a good synthesis would be:
      {
        "recruiter_specialty": "Placing senior sales leaders in high-growth B2B technology companies."
      }

      Return a single, valid JSON object with one key: "recruiter_specialty".
    `;

    const result = await callGemini(prompt, GEMINI_API_KEY);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Edge Function error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});