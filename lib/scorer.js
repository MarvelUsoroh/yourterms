// lib/scorer.js
// Converts an array of LLM-flagged clauses into a 0–100 risk score and
// a traffic-light level (safe / caution / danger).
// Formula (from yourTerms interim report §4.2):
//   score = (high × 30) + (medium × 15) + (low × 5), capped at 100
import { CONFIG } from '../config.js';

const WEIGHTS = { high: 30, medium: 15, low: 5 };

/**
 * @param {Array<{ risk_level: 'high'|'medium'|'low' }>} flags
 * @returns {{ score: number, level: 'safe'|'caution'|'danger', breakdown: object }}
 */
export function calculateScore(flags) {
  if (!flags || flags.length === 0) {
    return { score: 0, level: 'safe', breakdown: { high: 0, medium: 0, low: 0 } };
  }

  const breakdown = { high: 0, medium: 0, low: 0 };
  for (const flag of flags) {
    const key = flag.risk_level?.toLowerCase();
    if (key in breakdown) breakdown[key]++;
  }

  const raw = (breakdown.high * WEIGHTS.high)
    + (breakdown.medium * WEIGHTS.medium)
    + (breakdown.low * WEIGHTS.low);

  const score = Math.min(Math.round(raw), 100);
  const level = getLevel(score);

  return { score, level, breakdown };
}

/**
 * @param {number} score
 * @returns {'safe'|'caution'|'danger'}
 */
export function getLevel(score) {
  if (score < CONFIG.THRESHOLD_SAFE) return 'safe';
  if (score < CONFIG.THRESHOLD_CAUTION) return 'caution';
  return 'danger';
}

/**
 * Human-readable label for a level.
 */
export const LEVEL_LABELS = {
  safe: 'Low risk',
  caution: 'Review needed',
  danger: 'High risk',
};

/**
 * CSS class suffix for each level — matches tokens in DESIGN.md.
 */
export const LEVEL_CLASSES = {
  safe: 'safe',
  caution: 'caution',
  danger: 'danger',
};
