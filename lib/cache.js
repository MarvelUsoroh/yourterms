// lib/cache.js
// Two-tier cache:
//   Tier 1 — chrome.storage.local  (instant, user's machine)
//   Tier 2 — Supabase              (shared across all yourTerms users)
// Read order:  local → Supabase → miss (trigger fresh analysis)
// Write order: local + Supabase simultaneously
import { CONFIG } from '../config.js';
import { SupabaseClient } from './supabase-client.js';

// Generate a stable hash for a URL (used as cache key).
export async function hashUrl(url) {
  const clean = url.replace(/[?#].*$/, '').toLowerCase().replace(/\/$/, '');
  const encoded = new TextEncoder().encode(clean);
  const buf = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Extract clean domain from URL.
export function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const LOCAL_PREFIX = 'yourTerms_cache_';
const TTL_MS = CONFIG.CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

async function getLocal(key) {
  return new Promise(resolve => {
    chrome.storage.local.get(LOCAL_PREFIX + key, result => {
      const entry = result[LOCAL_PREFIX + key];
      if (!entry) return resolve(null);
      if (Date.now() > entry.expiresAt) {
        chrome.storage.local.remove(LOCAL_PREFIX + key);
        return resolve(null);
      }
      resolve(entry.data);
    });
  });
}

async function setLocal(key, data) {
  return new Promise(resolve => {
    chrome.storage.local.set({
      [LOCAL_PREFIX + key]: { data, expiresAt: Date.now() + TTL_MS },
    }, resolve);
  });
}

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = new SupabaseClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return _supabase;
}

/**
 * Get cached analysis.
 * Returns { data, source: 'local'|'supabase' } or null.
 *
 * @param {string} urlHash
 * @param {string} domain
 */
export async function getCached(urlHash, domain, currentUrl) {
  // Tier 1: local — exact URL match (most reliable)
  const local = await getLocal(urlHash);
  if (local) return { data: local, source: 'local' };

  // Also check by domain, but ONLY if the cached URL path matches.
  // This prevents e.g. TikTok Terms of Service results appearing on the Privacy Policy page.
  const localDomain = await getLocal(`domain_${domain}`);
  if (localDomain && urlPathMatches(localDomain.tcUrl, currentUrl)) {
    return { data: localDomain, source: 'local' };
  }

  // Tier 2: Supabase
  const sb = getSupabase();
  const remote = await sb.getAnalysis(urlHash);
  if (remote) {
    await setLocal(urlHash, remote);
    return { data: remote, source: 'supabase' };
  }

  // Supabase domain fallback — also verify URL path
  const remoteDomain = await sb.getAnalysisByDomain(domain);
  if (remoteDomain && urlPathMatches(remoteDomain.tc_url || remoteDomain.tcUrl, currentUrl)) {
    await setLocal(urlHash, remoteDomain);
    return { data: remoteDomain, source: 'supabase' };
  }

  return null;
}

// Check that two URLs share the same path (ignoring query/hash).
function urlPathMatches(cachedUrl, currentUrl) {
  if (!cachedUrl || !currentUrl) return false;
  try {
    const a = new URL(cachedUrl);
    const b = new URL(currentUrl);
    return a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '');
  } catch {
    return false;
  }
}

/**
 * Save analysis to both tiers.
 *
 * @param {object} analysis - Full analysis result object
 */
export async function saveCache(analysis) {
  const { urlHash, domain, flags } = analysis;

  // Use a short TTL for 0-flag results (may mean extraction was incomplete)
  // and the normal TTL for results with actual flags.
  const hasFlags = flags && flags.length > 0;
  const ttl = hasFlags ? TTL_MS : 24 * 60 * 60 * 1000; // 24h for clean, 30d for flagged
  const expiresAt = new Date(Date.now() + ttl).toISOString();

  // Tier 1: local (fire and forget)
  chrome.storage.local.set({
    [LOCAL_PREFIX + urlHash]: { data: analysis, expiresAt: Date.now() + ttl },
  });
  if (hasFlags) {
    chrome.storage.local.set({
      [LOCAL_PREFIX + `domain_${domain}`]: { data: analysis, expiresAt: Date.now() + ttl },
    });
  }

  // Tier 2: Supabase (only for flagged results — no point sharing clean results globally)
  if (!hasFlags) return;
  const sb = getSupabase();
  await sb.saveAnalysis({
    domain,
    url_hash: urlHash,
    risk_score: analysis.riskScore,
    risk_level: analysis.riskLevel,
    clauses_checked: analysis.clausesChecked,
    flags_found: analysis.flags.length,
    flags: analysis.flags,
    tc_url: analysis.tcUrl || null,
    jurisdiction: analysis.jurisdiction || 'Unknown',
    expires_at: expiresAt,
  });
}

/**
 * Clear cached analysis for a specific URL and domain.
 * Wipes both the URL-hash key and the domain-level key.
 * Called by Re-analyse to force a fresh Gemini run.
 *
 * @param {string} urlHash
 * @param {string} domain
 */
export async function clearLocalCache(urlHash, domain) {
  await new Promise(resolve =>
    chrome.storage.local.remove(
      [LOCAL_PREFIX + urlHash, LOCAL_PREFIX + `domain_${domain}`],
      resolve
    )
  );
}

/**
 * Load pre-built cache for popular sites from bundled JSON.
 * Called once on service worker startup.
 */
export async function seedPopularCache() {
  // Bump version to _seeded_v4 whenever the seed schema changes,
  // forcing existing installs to re-run and pick up new entries.
  const alreadySeeded = await getLocal('_seeded_v4');
  if (alreadySeeded) return;

  try {
    const url = chrome.runtime.getURL('data/popular-tc-cache.json');
    const res = await fetch(url);
    const entries = await res.json();
    for (const entry of entries) {
      // Store by domain (for partial-match lookups)
      await setLocal(`domain_${entry.domain}`, entry);
      // Store by the arbitrary urlHash identifier
      if (entry.urlHash) {
        await setLocal(entry.urlHash, entry);
      }
      // Also store by the SHA-256 hash of the actual tcUrl.
      // This ensures that visiting the exact policy URL always hits the cache
      // even when the domain-level path check fails (e.g. Meta Privacy vs Terms).
      if (entry.tcUrl) {
        const tcHash = await hashUrl(entry.tcUrl);
        await setLocal(tcHash, entry);
      }
    }
    await setLocal('_seeded_v4', true);
  } catch {
    // Non-fatal — extension works without seed data
  }
}
