/// <reference no-default-lib="true" />
/// <reference lib="deno.ns" />
/// <reference lib="esnext" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { 'x-my-custom-header': 'Contract-Engine' } } }
    );

    const requestBody = await req.json();
    const userCommand = requestBody.command;

    if (!userCommand) {
      return new Response(JSON.stringify({ error: 'Command is required in the request body.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in environment variables.");
    }

    // Enhanced prompt for Gemini to identify opportunity searches
    const prompt = `User command: "${userCommand}". As an AI recruiting assistant, determine if the user is asking to find or search for job opportunities. If so, respond with 'Initiating search for opportunities...' followed by a brief, helpful message about the search. Otherwise, provide a concise, helpful general response.`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt,
            }],
          }],
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json();
      console.error("Gemini API error:", errorData);
      throw new Error(`Gemini API error: ${geminiResponse.statusText} - ${JSON.stringify(errorData)}`);
    }

    const geminiResult = await geminiResponse.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text: string;
          }>;
        };
      }>;
    };
    const aiResponseText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";

    return new Response(JSON.stringify({ response: aiResponseText }), {
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