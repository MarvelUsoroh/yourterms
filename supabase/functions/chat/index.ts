// @ts-ignore - Deno import is valid in Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// @ts-ignore - Deno global is injected by Supabase runtime
declare const Deno: any;

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GEMINI_API") ?? Deno.env.get("gemini_api") ?? "";
const GEMINI_MODEL   = "gemini-2.5-flash";
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { question, tcText, history, userApiKey } = await req.json();
    if (!question || !tcText) throw new Error("Missing question or text payload");

    const apiKey = (userApiKey && userApiKey.trim() !== "") ? userApiKey.trim() : GEMINI_API_KEY;

    const sysPrompt = `You are yourTerms, a legal transparency assistant. 
Answer questions about Terms & Conditions in extremely simple, plain English. 
Explain it like you are talking to a 15-year-old. ABSOLUTELY NO LEGAL JARGON. 
If the text uses words like "liability", "disclaims", "indemnify", or 
"arbitration", you MUST translate them into everyday scenarios. Ground all answers in 
the actual text provided. Keep answers concise (2–3 sentences). Never give 
formal legal advice.

T&C TEXT:
---
${String(tcText).slice(0, 80000)}
---`;

    const messages = [
      ...(history || []).map((m: any) => ({ role: m.role, parts: [{ text: m.content }] })),
      { role: 'user', parts: [{ text: question }] },
    ];

    const payload = {
      system_instruction: { parts: [{ text: sysPrompt }] },
      contents: messages,
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    };

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let answer = "I'm sorry, I couldn't generate an answer.";

    if (!res.ok) {
      const err = await res.text();
      const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") ?? "";

      if (DEEPSEEK_API_KEY) {
        console.warn(`[chat] Gemini failed (${res.status}). Falling back to DeepSeek...`);
        
        const dsMessages = [
          { role: "system", content: sysPrompt },
          ...(history || []).map((m: any) => ({ 
            role: m.role === "model" ? "assistant" : m.role, 
            content: m.content 
          })),
          { role: "user", content: question }
        ];

        const dsRes = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: dsMessages,
            temperature: 0.3
          })
        });

        if (!dsRes.ok) {
          const dsErr = await dsRes.text();
          throw new Error(`Fallback failed. DeepSeek ${dsRes.status}: ${dsErr.slice(0, 200)}`);
        }

        const dsJson = await dsRes.json();
        answer = dsJson.choices?.[0]?.message?.content ?? answer;
      } else {
        if (res.status === 403) {
          throw new Error("API Key denied access. Please check your Gemini API key in settings or create a new one.");
        }
        return new Response(JSON.stringify({ error: err }), { status: res.status, headers: { ...CORS, "Content-Type": "application/json" }});
      }
    } else {
      const geminiJson = await res.json();
      answer = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text ?? answer;
    }

    return new Response(JSON.stringify({ answer }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Unknown error" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});