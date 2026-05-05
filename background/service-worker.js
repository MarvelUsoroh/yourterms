// background/service-worker.js
// background/service-worker.js
// handles api calls and cache
// runs in background
// no imports here so it works on older chrome
//  Config (mirrors config.js) ──────────────────────────────────────────────
// get keys from storage or use defaults

async function getConfig() {
  return new Promise(resolve => {
    chrome.storage.sync.get({
      geminiKey: '',
      supabaseUrl: '',
      supabaseKey: '',
      cacheTtlDays: 30,
    }, (result) => {
      // Force fallback to project-specific keys if the user hasn't configured their own
      if (!result.supabaseUrl || !result.supabaseKey) {
        result.supabaseUrl = 'https://wrbnkyhpuynepszchyyh.supabase.co';
        result.supabaseKey = 'sb_publishable_vGCjQnNjMR6f5DOWto7etg_FMlUyCwt';
      }
      resolve(result);
    });
  });
}

// categories to look out for
const INTENT_ANCHORS = {
  UNILATERAL_CHANGE: "The company may modify the terms or policies at any time without obtaining renewed consent, and continued use constitutes acceptance.",
  UNILATERAL_TERMINATION: "The company may suspend or terminate the user's account or access to the service at its sole discretion without prior notice or stated cause.",
  LIMITATION_OF_LIABILITY: "The company disclaims all responsibility for data loss, breaches, or damages arising from use of the service to the maximum extent permitted by law.",
  CONTENT_OWNERSHIP: "The user grants the company a broad license to use, reproduce, and sublicense their content, OR the company authorizes the broad collection, sharing, or sale of user data and personal information to third parties.",
  JURISDICTION: "Disputes must be resolved through binding arbitration in a specified venue, the user waives class action rights, OR data may be transferred to and processed in countries with weaker privacy protections (like the US) without sufficient regulatory safeguards."
};

// check supabase cache
async function supabaseGet(url, key, urlHash) {
  if (!url || !key) return null;
  try {
    const now = new Date().toISOString();
    const endpoint = `${url}/rest/v1/tc_analyses?url_hash=eq.${encodeURIComponent(urlHash)}&expires_at=gt.${now}&limit=1`;
    const res = await fetch(endpoint, {
      headers: { 'apikey': key },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0] || null;
  } catch { return null; }
}

async function supabaseSave(url, key, record) {
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/tc_analyses?on_conflict=url_hash`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(record),
    });
  } catch { /* non-fatal */ }
}

// listen for messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ANALYSE') {
    handleAnalyse(message).then(sendResponse).catch(err => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === 'CHAT') {
    handleChat(message).then(sendResponse).catch(err => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === 'SAVE_KEYS') {
    chrome.storage.sync.set(message.keys, () => sendResponse({ ok: true }));
    return true;
  }
});

function detectJurisdiction(url, text) {
  // check url for location
  if (url && (
    url.includes('.eu') || url.includes('/eea/') ||
    url.includes('.co.uk') || url.includes('/uk/') ||
    url.includes('/en-gb/') || url.includes('/legal/page/eea/')
  )) {
    return 'EEA/UK';
  }

  // check text for eu/uk mentions
  const intro = (text || '').slice(0, 2000).toLowerCase();
  if (
    intro.includes('european economic area') ||
    intro.includes(' eea ') ||
    intro.includes(' gdpr ') ||
    intro.includes('tiktok technology limited') // TikTok's EEA entity
  ) {
    return 'EEA/UK';
  }

  return 'US / ROW';
}

async function handleAnalyse({ flaggedParagraphs, domain, urlHash, tcUrl, clausesChecked, force }) {
  const cfg = await getConfig();

  // try cache first
  const cached = await supabaseGet(cfg.supabaseUrl, cfg.supabaseKey, urlHash);
  if (!force && cached) {
    return {
      flags: cached.flags || [],
      riskScore: cached.risk_score,
      riskLevel: cached.risk_level,
      clausesChecked: cached.clauses_checked,
      jurisdiction: cached.jurisdiction || 'Unknown',
      fromCache: true,
      cacheSource: 'supabase',
    };
  }

  // call supabase edge function
  if (!cfg.supabaseUrl || !cfg.supabaseKey) {
    throw new Error('Supabase URL/Key not set. Open yourTerms settings to configure.');
  }

  const endpoint = `${cfg.supabaseUrl}/functions/v1/analyse`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.supabaseKey}`
    },
    body: JSON.stringify({ flaggedParagraphs, userApiKey: cfg.geminiKey })
  });

  if (!res.ok) {
    let errMessage = await res.text();
    try {
      const parsed = JSON.parse(errMessage);
      if (parsed.error) errMessage = parsed.error;
    } catch { /* ignore */ }
    throw new Error(`Analysis failed: ${errMessage}`);
  }

  const { flags, riskScore: score, riskLevel: level } = await res.json();
  const textToAnalyse = flaggedParagraphs.map(p => p.text).join('\n\n');
  const jurisdiction = detectJurisdiction(tcUrl, textToAnalyse);

  // make sure the llm isn't making things up by checking words
  const originalText = flaggedParagraphs.map(p => p.text).join(' ').toLowerCase();
  const verifiedFlags = flags.filter(flag => {
    if (!flag.excerpt || flag.excerpt.length < 10) return false;

    // get words longer than 4 chars
    const words = flag.excerpt.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 4);

    if (words.length === 0) return true; // can't verify — trust the LLM

    // check if words are in text
    const threshold = Math.min(3, words.length);
    const matches = words.filter(w => originalText.includes(w)).length;
    return matches >= threshold;
  });

  const result = {
    flags: verifiedFlags,
    riskScore: score,
    riskLevel: level,
    clausesChecked: clausesChecked || flaggedParagraphs.length,
    jurisdiction: jurisdiction,
    fromCache: false,
  };

  // save to db so we don't have to call api again
  const ttlMs = cfg.cacheTtlDays * 24 * 60 * 60 * 1000;
  supabaseSave(cfg.supabaseUrl, cfg.supabaseKey, {
    domain,
    url_hash: urlHash,
    risk_score: score,
    risk_level: level,
    clauses_checked: result.clausesChecked,
    flags_found: verifiedFlags.length,
    flags: verifiedFlags,
    tc_url: tcUrl || null,
    jurisdiction: jurisdiction,
    expires_at: new Date(Date.now() + ttlMs).toISOString(),
  });

  return result;
}

async function handleChat({ question, tcText, history }) {
  const cfg = await getConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseKey) throw new Error('Supabase configuration missing.');
  
  const endpoint = `${cfg.supabaseUrl}/functions/v1/chat`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.supabaseKey}`
    },
    body: JSON.stringify({ question, tcText, history, userApiKey: cfg.geminiKey })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Chat failed ${res.status}: ${errText}`);
  }

  const { answer } = await res.json();
  return { answer };
}

// Initial hook for first-time installation setup.
chrome.runtime.onInstalled.addListener(() => {
  // yourTerms ready — configure API keys via the extension popup settings (⚙)
});
