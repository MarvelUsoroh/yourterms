# yourTerms — Automated Legal Transparency Agent

---

## What is yourTerms?

yourTerms is a Chrome browser extension that reads Terms & Conditions pages and tells you — in plain English — what you are agreeing to.

Most people click "I Agree" without reading T&Cs because the documents are long, written in legal language, and full of clauses that quietly take away user rights. yourTerms solves this by:

1. **Automatically detecting** when you are on a Terms & Conditions or Privacy Policy page
2. **Scanning the text** for suspicious language using a keyword filter
3. **Sending only the suspicious paragraphs** to an AI model (Gemini 2.5 Flash) — not the whole document
4. **Displaying a 0–100 risk score** with a traffic-light colour (Green / Amber / Red)
5. **Explaining each flagged clause** in one plain-English sentence with the relevant GDPR article
6. **Letting you ask follow-up questions** via a built-in chat bar

---

## The 5 Unfair Clause Categories

These categories come from the academic CLAUDETTE dataset (Lippi et al., 2019) and EU Directive 93/13/EEC on unfair consumer contracts.

| Category | What it means in plain English | GDPR Concern |
|---|---|---|
| **Unilateral Change** | They can change the rules at any time without telling you | Art. 5 & 13 — Fairness & Transparency |
| **Unilateral Termination** | They can delete your account without warning or reason | Art. 21 — Right to Object |
| **Limitation of Liability** | They accept no responsibility if they lose your data or harm you | Art. 82 — Right to Compensation |
| **Content Ownership** | They get a permanent, worldwide licence to use anything you post | Art. 17 — Right to Erasure |
| **Jurisdiction** | Disputes must be settled in their country, not yours | Art. 77 — Right to Complain Locally |

---

## How the Pipeline Works (Step by Step)

```
You open a T&C page
        │
        ▼
[1] Content Script (detector.js)
    Checks if this is a T&C page (URL pattern, page title, heading)
    Extracts the main body text, removes navigation/ads/footers
        │
        ▼
[2] Keyword Pre-Filter (lib/keywords.js)  ← runs instantly, no API call
    Splits text into paragraphs
    Flags paragraphs matching 5-category regex patterns
    Reduces text sent to AI by ~70%
        │
        ▼
[3] Cache Check (lib/cache.js)
    Checks local browser storage first (chrome.storage.local)
    Then checks Supabase shared database (shared across all users)
    If found: shows result instantly — no AI call needed
        │
        ▼ (cache miss only)
[4] Supabase Edge Function (supabase/functions/analyse)
    Receives flagged paragraphs and securely calls Gemini 2.5 Flash API
    Returns structured JSON: { category, risk_level, gdpr_article, explanation }
    Filters out any AI hallucinations (checks excerpt exists in original text)
        │
        ▼
[5] Risk Scoring (lib/scorer.js)
    High risk clause = 30 points
    Medium risk clause = 15 points
    Low risk clause = 5 points
    Capped at 100. Score < 30 = Green, 30–60 = Amber, 61+ = Red
        │
        ▼
[6] Popup UI (popup/popup.js)
    Shows traffic-light badge + risk score
    Lists each flagged clause as a card with GDPR article and explanation
    Highlights the clause on the original page
    Chat bar lets you ask "Can they delete my account without warning?" etc.
        │
        ▼
[7] Cache Write-Back
    Saves result to Supabase so future users see it instantly
    TTL: 30 days
```

---

## Project Structure

```
yourterms/
│
├── manifest.json              Extension configuration (Manifest V3)
├── config.js                  API key placeholders (keys stored in chrome.storage)
│
├── content/
│   ├── detector.js            Runs on every page — detects T&C pages, extracts text
│   └── highlighter.js         Highlights flagged clauses directly on the webpage
│
├── background/
│   └── service-worker.js      Handles Gemini API calls and Supabase cache (runs in background)
│
├── lib/
│   ├── keywords.js            Stage 1: Keyword pre-filter — 5 categories, ~50 regex patterns
│   ├── analyser.js            Stage 2: Gemini API wrapper — structured JSON output
│   ├── scorer.js              Converts flagged clauses into a 0–100 risk score
│   ├── cache.js               Two-tier cache: local browser storage + Supabase
│   └── supabase-client.js     Lightweight Supabase REST client (no SDK dependency)
│
├── popup/
│   ├── index.html             The extension popup (380 × 560 px fixed)
│   ├── popup.js               Main UI controller — orchestrates the whole pipeline
│   └── styles/
│       ├── tokens.css         Design tokens: colours, spacing, border radius, shadows
│       ├── typography.css     Fonts, type scale, scrollbar styling
│       ├── components.css     All UI components: cards, badges, chat, buttons
│       └── animations.css     Keyframe animations (shimmer, bounce, fade-in, card-in)
│
├── data/
│   └── popular-tc-cache.json  Pre-built analyses for 10 popular sites (Meta, TikTok, etc.)
│
├── supabase/
│   └── schema.sql             Database schema and Row Level Security policies
│
└── plan/
    └── yourTerms_project_plan.html Sprint plan, architecture diagram, model comparison, checklist
```

---

## Quick Setup (5 Minutes)

### 1. Get a free Gemini API key

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Sign in with a Google account → **Create API key**
3. Copy the key (starts with `AIza...`)
4. The free tier handles hundreds of analyses per day

### 2. Set up Supabase (Edge Functions & Cache)

1. Create a free project at [supabase.com](https://supabase.com)
2. Open **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and run it
3. Install the Supabase CLI: `npm install -g supabase`
4. Link your project: `supabase link --project-ref your-project-ref`
5. Set your Gemini API key as a secret: `supabase secrets set GEMINI_API_KEY=your_key_here`
6. Deploy the edge functions: `supabase functions deploy analyse` and `supabase functions deploy chat`
7. Go to **Settings → API** and copy the **Project URL** and **anon key**

### 3. Load the extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked** → select the `yourterms/` folder
4. The yourTerms icon appears in the browser toolbar

### 4. Enter your API keys

1. Click the yourTerms icon → click the ⚙ settings button
2. Optionally paste your own Gemini API key (the extension uses a project-wide key by default)
3. Click **Save keys** — keys are stored in `chrome.storage.sync`, never in the source code

---

## Using yourTerms

1. Navigate to any Terms & Conditions or Privacy Policy page
2. yourTerms auto-detects it and starts analysing (takes 3–8 seconds on first visit)
3. Read the risk score and flagged clauses in the popup
4. Click **View on page ↗** to see highlighted clauses on the actual T&C page
5. Click **Ask yourTerms →** on any clause to ask a follow-up question in plain English
6. For pages yourTerms can't auto-detect, paste the T&C text manually into the text area

---

## Architecture Decisions

| Decision | Why |
|---|---|
| Chrome Extension (not web app) | Works on any T&C page without copy-pasting — reduces friction to zero |
| Keyword pre-filter before LLM | Cuts token cost by ~70%; also gives instant preliminary feedback |
| Gemini 2.5 Flash (not GPT-4o) | 1M token context window fits any T&C; free tier available for development |
| Supabase shared cache | Popular sites (TikTok, Meta, Amazon) get cached within hours of first analysis |
| No fine-tuning | Few-shot prompting achieves comparable accuracy without infrastructure complexity |
| No bundler (Webpack/Vite) | Chrome extensions support ES modules natively — keeps the project simple |
