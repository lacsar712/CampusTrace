export const MATCH_RULES = {
  CATEGORY_SCORE: 40,
  LOCATION_SCORE: 40,
  LOCATION_EXACT_SCORE: 50,
  DATE_PENALTY_PER_DAY: 1,
  MAX_DATE_GAP_DAYS: 21,
  MIN_SCORE_THRESHOLD: 60,
  HIGH_SCORE_THRESHOLD: 80,
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const normalize = (val) => (val == null ? '' : String(val).toLowerCase().trim());

const dayDiff = (dateA, dateB) => {
  const a = new Date(dateA);
  const b = new Date(dateB);
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor(Math.abs(utcA - utcB) / MS_PER_DAY);
};

export const computeMatchScore = (lostItem, foundItem, options = {}) => {
  const rules = { ...MATCH_RULES, ...options };
  const reasons = [];
  let score = 0;

  if (lostItem && foundItem && lostItem.category === foundItem.category) {
    score += rules.CATEGORY_SCORE;
    reasons.push('category');
  }

  const lostLoc = normalize(lostItem?.location);
  const foundLoc = normalize(foundItem?.foundLocation);
  if (lostLoc && foundLoc) {
    if (lostLoc === foundLoc) {
      score += rules.LOCATION_EXACT_SCORE;
      reasons.push('location:exact');
    } else if (lostLoc.includes(foundLoc) || foundLoc.includes(lostLoc)) {
      score += rules.LOCATION_SCORE;
      reasons.push('location');
    }
  }

  const gap = lostItem && foundItem ? dayDiff(lostItem.dateLost, foundItem.dateFound) : 0;
  reasons.push(`dateGap:${gap}`);

  score = Math.max(0, score - gap * rules.DATE_PENALTY_PER_DAY);

  return { score, reasons };
};

export const buildPairKey = (lostItemId, foundItemId) => `${lostItemId}__${foundItemId}`;

export const formatReason = (reason) => {
  if (reason === 'category') return '🏷️ Category match';
  if (reason === 'location:exact') return '📍 Exact location match';
  if (reason === 'location') return '📍 Location partial match';
  if (reason.startsWith('dateGap:')) {
    const days = reason.split(':')[1];
    return `📅 ${days} day${days === '1' ? '' : 's'} apart`;
  }
  return reason;
};
