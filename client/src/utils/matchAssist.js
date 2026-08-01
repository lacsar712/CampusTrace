// ─────────────────────────────────────────────────────────────────────────────
// CampusTrace — Match scoring (Frontend authority)
//
// This is ONE of the ONLY TWO modules in the whole project allowed to contain
// the match scoring formula and threshold logic. The backend twin lives in
// services/matchAssist.js and MUST stay behaviourally identical (same inputs →
// same { score, reasons }).
//
// No page component, Controller, or Route may re-implement the formula, the
// threshold comparison, or the pairKey format. Always call the helpers here.
// ─────────────────────────────────────────────────────────────────────────────

// Match rules v2 — the single place these numbers are defined on the frontend.
export const MATCH_RULES = {
  categoryBase: 40,     // base points when categories match exactly
  locationExact: 50,    // points when locations are exactly equal (normalized)
  locationBonus: 40,    // points when locations overlap (bidirectional contains)
  timeWindowDays: 21,   // gap strictly greater than this eliminates the pair
  dailyPenalty: 1,      // points deducted per full day of date gap
  displayThreshold: 60, // minimum score required to be shown to any user
  conflictThreshold: 80, // score at/above which a pair is a "high-score" match
                         // (claim-conflict hint + Admin high-pairs panel)
};

const DAY_MS = 24 * 60 * 60 * 1000;

const normalize = (value) => (value == null ? '' : String(value)).trim().toLowerCase();

// Location tiers (normalized = trimmed + lowercased):
//   'exact'   → both sides equal
//   'contain' → either side contains the other
//   'none'    → no overlap (or a side is empty)
const locationTier = (lostLocation, foundLocation) => {
  const a = normalize(lostLocation);
  const b = normalize(foundLocation);
  if (!a || !b) return 'none';
  if (a === b) return 'exact';
  if (a.includes(b) || b.includes(a)) return 'contain';
  return 'none';
};

// Whole-day absolute difference between the two dates.
const dayGap = (dateLost, dateFound) => {
  const a = new Date(dateLost).getTime();
  const b = new Date(dateFound).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity;
  return Math.floor(Math.abs(a - b) / DAY_MS);
};

// The single canonical pairKey format for the whole project: `${lostId}__${foundId}`.
export const buildPairKey = (lostItemId, foundItemId) => `${lostItemId}__${foundItemId}`;

/**
 * Compute the match score between a lost item and a found item.
 *
 * @param {object} lostItem  - must expose { category, location, dateLost }
 * @param {object} foundItem - must expose { category, foundLocation, dateFound }
 * @param {object} [options] - optional overrides for MATCH_RULES
 * @returns {{ score: number, reasons: string[] }}
 *   score:   integer, never negative
 *   reasons: 'category' when categories match; for location either
 *            'location:exact' (normalized equality) or 'location' (bidirectional
 *            contains); and always 'dateGap:N' where N is the integer day diff.
 */
export const computeMatchScore = (lostItem, foundItem, options = {}) => {
  const rules = { ...MATCH_RULES, ...options };
  const reasons = [];

  const categoryHit = !!lostItem && !!foundItem && lostItem.category === foundItem.category;
  const tier = locationTier(lostItem && lostItem.location, foundItem && foundItem.foundLocation);
  const gap = dayGap(lostItem && lostItem.dateLost, foundItem && foundItem.dateFound);

  let score = 0;
  if (categoryHit) {
    score += rules.categoryBase;
    reasons.push('category');
  }
  if (tier === 'exact') {
    score += rules.locationExact;
    reasons.push('location:exact');
  } else if (tier === 'contain') {
    score += rules.locationBonus;
    reasons.push('location');
  }

  const safeGap = Number.isFinite(gap) ? gap : 0;
  score -= safeGap * rules.dailyPenalty;
  if (score < 0) score = 0;

  // Time window: a gap strictly greater than the window eliminates the pair outright.
  if (!Number.isFinite(gap) || gap > rules.timeWindowDays) {
    score = 0;
  }

  reasons.push(`dateGap:${safeGap}`);

  return { score, reasons };
};

// Threshold judgement lives here so no caller ever hard-codes the 60 comparison.
export const meetsDisplayThreshold = (score, options = {}) => {
  const rules = { ...MATCH_RULES, ...options };
  return score >= rules.displayThreshold;
};

// High-score judgement (claim-conflict hint + Admin panel). Kept here so no
// caller ever hard-codes the 80 comparison. Distinct from displayThreshold (60).
export const meetsConflictThreshold = (score, options = {}) => {
  const rules = { ...MATCH_RULES, ...options };
  return score >= rules.conflictThreshold;
};

// Maps a raw reason token into a short human-readable label for the UI.
export const formatReason = (reason) => {
  if (reason === 'category') return 'Same category';
  if (reason === 'location:exact') return 'Exact location match';
  if (reason === 'location') return 'Location overlap';
  if (typeof reason === 'string' && reason.startsWith('dateGap:')) {
    const days = reason.split(':')[1];
    return `${days} day${days === '1' ? '' : 's'} apart`;
  }
  return reason;
};
