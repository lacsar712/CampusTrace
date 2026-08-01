// ─── CampusTrace Match Assist (backend single source of truth) ───────────────
// Matching rules v2:
//  1. category must be exactly equal, otherwise the pair is excluded.
//  2. location vs foundLocation (case-insensitive, trimmed):
//     exact equality -> 50 pts ('location:exact');
//     else bidirectional "includes" hit -> 40 pts ('location'); otherwise 0.
//  3. |dateLost - dateFound| > 21 days -> pair is eliminated.
//  4. Score = 40 (category) + location points - 1 per day of gap (min 0).
//  5. Only pairs with score >= 60 may be shown to users.

const MATCH_RULES = {
  CATEGORY_BASE_SCORE: 40,
  LOCATION_EXACT_SCORE: 50,
  LOCATION_BONUS_SCORE: 40,
  DATE_PENALTY_PER_DAY: 1,
  MAX_DATE_GAP_DAYS: 21,
  DISPLAY_THRESHOLD: 60,
  HIGH_SCORE_THRESHOLD: 80,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Absolute day difference between two dates, rounded to an integer. */
const getDateGapDays = (dateA, dateB) => {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round(Math.abs(a - b) / MS_PER_DAY);
};

/** Case-insensitive bidirectional containment check. */
const isLocationHit = (location, foundLocation) => {
  const a = String(location || '').trim().toLowerCase();
  const b = String(foundLocation || '').trim().toLowerCase();
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
};

/** Case-insensitive, trimmed exact equality check. */
const isLocationExact = (location, foundLocation) => {
  const a = String(location || '').trim().toLowerCase();
  const b = String(foundLocation || '').trim().toLowerCase();
  if (!a || !b) return false;
  return a === b;
};

/** Unique identifier of a (lostItem x foundItem) pair. */
const getPairKey = (lostItemId, foundItemId) => `${lostItemId}__${foundItemId}`;

/**
 * Compute the match score for a (lostItem, foundItem) pair.
 * @returns {{ score: number, reasons: string[] }}
 *   reasons elements: 'category' | 'location' | 'location:exact' | 'dateGap:N'
 *   Excluded pairs (category mismatch / date gap > 21d) return { score: 0, reasons: [] }.
 */
const computeMatchScore = (lostItem, foundItem, options = {}) => {
  const rules = { ...MATCH_RULES, ...options };

  if (!lostItem || !foundItem) return { score: 0, reasons: [] };

  // Rule 1: category must match exactly
  if (lostItem.category !== foundItem.category) return { score: 0, reasons: [] };

  // Rule 3: hard elimination outside the time window
  const dateGap = getDateGapDays(lostItem.dateLost, foundItem.dateFound);
  if (dateGap > rules.MAX_DATE_GAP_DAYS) return { score: 0, reasons: [] };

  // Rule 4: scoring
  const reasons = ['category'];
  let score = rules.CATEGORY_BASE_SCORE;

  if (isLocationExact(lostItem.location, foundItem.foundLocation)) {
    score += rules.LOCATION_EXACT_SCORE;
    reasons.push('location:exact');
  } else if (isLocationHit(lostItem.location, foundItem.foundLocation)) {
    score += rules.LOCATION_BONUS_SCORE;
    reasons.push('location');
  }

  score = Math.max(0, score - dateGap * rules.DATE_PENALTY_PER_DAY);
  reasons.push(`dateGap:${dateGap}`);

  return { score, reasons };
};

/**
 * Score a lost item against a list of found items and return only displayable
 * candidates (score >= DISPLAY_THRESHOLD), sorted by score descending.
 * Every element: { pairKey, score, reasons, foundItem }
 */
const buildMatches = (lostItem, foundItems, options = {}) => {
  const rules = { ...MATCH_RULES, ...options };

  return (foundItems || [])
    .map((foundItem) => ({
      pairKey: getPairKey(lostItem._id, foundItem._id),
      ...computeMatchScore(lostItem, foundItem, rules),
      foundItem,
    }))
    .filter((match) => match.score >= rules.DISPLAY_THRESHOLD)
    .sort((a, b) => b.score - a.score);
};

module.exports = {
  MATCH_RULES,
  computeMatchScore,
  buildMatches,
  getPairKey,
  getDateGapDays,
  isLocationHit,
  isLocationExact,
};
