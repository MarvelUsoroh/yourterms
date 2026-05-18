// @ts-ignore - Deno import is valid in Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// @ts-ignore - Deno global is injected by Supabase runtime
declare const Deno: any;

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GEMINI_API") ?? Deno.env.get("gemini_api") ?? "";
const GEMINI_MODEL   = "gemini-2.5-flash";
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are a GDPR compliance analyst specialising in consumer protection law under EU Directive 93/13/EEC and GDPR (EU 2016/679).

Classify Terms & Conditions and Privacy Policy clauses into one of these 5 unfair categories:
1. UNILATERAL_CHANGE     – The company may modify the terms or policies at any time without obtaining renewed consent, and continued use constitutes acceptance. (Art. 5 & 13)
2. UNILATERAL_TERMINATION – The company may suspend or terminate the user's account or access to the service at its sole discretion without prior notice or stated cause. (Art. 21)
3. LIMITATION_OF_LIABILITY – The company disclaims all responsibility for data loss, breaches, or damages arising from use of the service to the maximum extent permitted by law. (Art. 82)
4. CONTENT_OWNERSHIP     – The user grants the company a broad license to use, reproduce, and sublicense their content, OR the company authorizes the broad collection, sharing, or sale of user data and personal information to third parties. (Art. 17)
5. JURISDICTION          – Disputes must be resolved through binding arbitration in a specified venue, the user waives class action rights, OR data may be transferred to and processed in countries with weaker privacy protections (like the US) without sufficient regulatory safeguards. (Art. 77)

CRITICAL INSTRUCTION - SIN (Sub-Intent Neutralization):
Companies often mask hostile clauses behind friendly summaries (e.g., "In short: we own your content" or "Simply put: we can ban you anytime"). 
You MUST identify the hostile legal intent hidden behind these friendly paraphrases. If a clause attempts to neutralize severe legal consequences using conversational or colloquial language, flag it immediately with a 'high' risk level.

BORDERLINE CASES — ALWAYS FLAG:
When you are uncertain whether a clause is unfair, always resolve in favour of the user by flagging it. A missed risk is more harmful than a false positive. Assign borderline clauses 'low' or 'medium' risk_level so the user can judge for themselves. Never silently drop a clause just because you are uncertain.

CONSISTENCY RULE:
Your output must be fully deterministic. Given the same paragraphs, always produce exactly the same flags, categories, risk levels, and excerpts. Do not vary your output between calls.

OUTPUT FORMAT:
Return ONLY a single valid JSON array containing all identified issues. Do NOT wrap it in markdown blockquotes. Do NOT add conversational text. Do NOT output multiple arrays.

EXAMPLE INPUT:
Paragraph 1: "We reserve the right to suspend your account without notice."
Paragraph 2: "We are not liable for any data loss."

EXAMPLE OUTPUT:
[
  {
    "category": "UNILATERAL_TERMINATION",
    "risk_level": "high",
    "gdpr_article": "Art. 21",
    "excerpt": "suspend your account without notice",
    "explanation": "They can delete your account at any time without warning or reason."
  },
  {
    "category": "LIMITATION_OF_LIABILITY",
    "risk_level": "high",
    "gdpr_article": "Art. 82",
    "excerpt": "not liable for any data loss",
    "explanation": "If their system deletes all your data, they take no responsibility."
  }
]

If nothing unfair found, output EXACTLY: []`;

// ── CORS headers ──────────────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  try {
    const body = await req.json();
    const { flaggedParagraphs, userApiKey } = body;

    const apiKey = (userApiKey && userApiKey.trim() !== "") ? userApiKey.trim() : GEMINI_API_KEY;

    if (!flaggedParagraphs || !Array.isArray(flaggedParagraphs)) {
      return new Response(
        JSON.stringify({ error: "flaggedParagraphs array required" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    if (flaggedParagraphs.length === 0) {
      return new Response(
        JSON.stringify({ flags: [], riskScore: 0, riskLevel: "safe" }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const numbered = flaggedParagraphs
      .map((p: { text: string }, i: number) => `Paragraph ${i + 1}: "${p.text}"`)
      .join("\n");

    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: numbered }] }],
        generationConfig: {
          temperature: 0,        // deterministic output — safe at 0 when thinking is disabled
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          thinkingConfig: {
            thinkingBudget: 0,   // disables chain-of-thought reasoning; required to unlock temperature=0
          },
        },
      }),
    });

    let rawText = "[]";

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") ?? "";
      
      // Fallback: If Gemini fails for any reason (Rate limit, 403, 500+), try DeepSeek V4 Flash
      if (DEEPSEEK_API_KEY) {
        console.warn(`[analyse] Gemini failed (${geminiRes.status}). Falling back to DeepSeek...`);
        
        const dsRes = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
          },
          body: JSON.stringify({
            model: "deepseek-v4-flash",       // replaces deprecated 'deepseek-chat' (end-of-life Jul 24 2026)
            thinking: { type: "disabled" },   // CRITICAL: thinking mode is ON by default on v4-flash;
                                              // disabling it eliminates chain-of-thought non-determinism
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: numbered }
            ],
            // Use "text" not "json_object" — json_object forces a wrapper object {}
            // which breaks our array parser. The prompt already instructs plain JSON array output.
            response_format: { type: "text" },
            temperature: 0  // 0 = fully deterministic token sampling
          })
        });

        if (!dsRes.ok) {
          const dsErr = await dsRes.text();
          throw new Error(`Fallback failed. DeepSeek ${dsRes.status}: ${dsErr.slice(0, 200)}`);
        }

        const dsJson = await dsRes.json();
        rawText = dsJson.choices?.[0]?.message?.content ?? "[]";
      } else {
        // If it's a 403 or we don't have a DeepSeek key, throw normal Gemini error
        if (geminiRes.status === 403) {
          throw new Error("API Key denied access. Please check your Gemini API key in settings or create a new one.");
        }
        console.error("[analyse] Gemini error:", geminiRes.status, errText.slice(0, 300));
        throw new Error(`Gemini ${geminiRes.status}: ${errText.slice(0, 200)}`);
      }
    } else {
      // Success: Parse standard Gemini 2.5 Flash response
      const geminiJson = await geminiRes.json();
      const parts = geminiJson.candidates?.[0]?.content?.parts ?? [];

      // Extract the actual JSON answer, skipping the 'thought' part
      const answerPart = parts.find((p: any) => !p.thought && p.text) ?? parts[parts.length - 1];
      rawText = answerPart?.text ?? "[]";
    }

    let flags: any[] = [];
    try {
      const startIdx = rawText.indexOf('[');
      const endIdx = rawText.lastIndexOf(']');
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const clean = rawText.substring(startIdx, endIdx + 1);
        const parsed = JSON.parse(clean);
        if (Array.isArray(parsed)) {
          flags = parsed
            .filter((f: any) => f && f.category)
            .map((f: any) => ({
              category:     String(f.category).toUpperCase(),
              risk_level:   ["high","medium","low"].includes(f.risk_level) ? f.risk_level : "medium",
              gdpr_article: String(f.gdpr_article ?? ""),
              excerpt:      String(f.excerpt ?? "").slice(0, 200),
              explanation:  String(f.explanation ?? "").slice(0, 300),
            }));
        }
      }
    } catch (parseErr) {
      console.error("[analyse] parse error:", parseErr, "raw:", rawText.slice(0, 200));
      flags = [];
    }

    const weights: Record<string, number> = { high: 30, medium: 15, low: 5 };
    const raw = flags.reduce((sum: number, f: any) => sum + (weights[f.risk_level] ?? 5), 0);
    const riskScore = Math.min(raw, 100);
    const riskLevel = riskScore < 30 ? "safe" : riskScore < 61 ? "caution" : "danger";

    return new Response(
      JSON.stringify({ flags, riskScore, riskLevel }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[analyse] fatal:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
