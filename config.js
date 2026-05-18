// ─────────────────────────────────────────────────────────────────────────────
// yourTerms — Configuration
// ─────────────────────────────────────────────────────────────────────────────
//
// SETUP INSTRUCTIONS
//
//  1. Create a free Supabase project at https://supabase.com
//
//  2. Deploy the Edge Functions to your project:
//       supabase login
//       supabase link --project-ref YOUR_PROJECT_REF
//       supabase functions deploy analyse
//       supabase functions deploy chat
//
//  3. Set your Gemini API key as a Supabase secret:
//       supabase secrets set GEMINI_API_KEY=your_gemini_key_here
//     (Get a free key at https://aistudio.google.com/apikey)
//
//  4. Replace the two placeholder values below with your own project details
//     from Supabase Dashboard → Settings → API:
//
//       SUPABASE_URL     → Project URL  (e.g. https://xyzabc.supabase.co)
//       SUPABASE_ANON_KEY → Public anon key  (safe to commit — RLS enforces access)
//
// ─────────────────────────────────────────────────────────────────────────────

export const CONFIG = {
  SUPABASE_URL: 'https://wrbnkyhpuynepszchyyh.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_vGCjQnNjMR6f5DOWto7etg_FMlUyCwt',

  // Cache TTL in days — analyses older than this are considered stale
  CACHE_TTL_DAYS: 30,

  // Risk score thresholds (0–100)
  THRESHOLD_SAFE: 30,    // 0–29   = safe (green)
  THRESHOLD_CAUTION: 61, // 30–60  = caution (amber)
                         // 61–100 = danger (red)
};

