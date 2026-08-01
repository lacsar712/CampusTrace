const MATCH_RULES = {
  CATEGORY_SCORE: 40,
  LOCATION_SCORE: 40,
  LOCATION_EXACT_SCORE: 50,
  DATE_WINDOW_DAYS: 21,
  DATE_PENALTY_PER_DAY: 1,
  DISPLAY_THRESHOLD: 60,
  HIGH_SCORE_THRESHOLD: 80,
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const normalizeLocation = (value) =>
  (value || '').toString().trim().toLowerCase();

const getLocationMatchType = (lostLocation, foundLocation) => {
  const a = normalizeLocation(lostLocation);
  const b = normalizeLocation(foundLocation);
  if (!a || !b) return 'none';
  if (a === b) return 'exact';
  if (a.includes(b) || b.includes(a)) return 'partial';
  return 'none';
};

const isLocationMatch = (lostLocation, foundLocation) =>
  getLocationMatchType(lostLocation, foundLocation) !== 'none';

const getDayGap = (dateLost, dateFound) => {
  const d1 = new Date(dateLost);
  const d2 = new Date(dateFound);
  const diffMs = Math.abs(d1.getTime() - d2.getTime());
  return Math.round(diffMs / MS_PER_DAY);
};

const buildPairKey = (lostItemId, foundItemId) =>
  `${lostItemId}__${foundItemId}`;

const computeMatchScore = (lostItem, foundItem, options = {}) => {
  const reasons = [];
  let score = 0;

  if (!lostItem || !foundItem) {
    return { score: 0, reasons, pairKey: '' };
  }

  const pairKey = buildPairKey(
    lostItem._id || lostItem.id || '',
    foundItem._id || foundItem.id || ''
  );

  // Rule 1: category must match exactly (case-sensitive on the enum value).
  if (lostItem.category !== foundItem.category) {
    return { score: 0, reasons, pairKey };
  }

  score += MATCH_RULES.CATEGORY_SCORE;
  reasons.push('category');

  // Rule 2: case-insensitive exact match scores 50, bidirectional
  // substring (partial) match scores 40, otherwise 0.
  const locationType = getLocationMatchType(
    lostItem.location,
    foundItem.foundLocation
  );
  if (locationType === 'exact') {
    score += MATCH_RULES.LOCATION_EXACT_SCORE;
    reasons.push('location:exact');
  } else if (locationType === 'partial') {
    score += MATCH_RULES.LOCATION_SCORE;
    reasons.push('location');
  }

  // Rule 3: date gap — hard cutoff at 21 days.
  const dayGap = getDayGap(lostItem.dateLost, foundItem.dateFound);
  reasons.push(`dateGap:${dayGap}`);

  if (dayGap > MATCH_RULES.DATE_WINDOW_DAYS) {
    return { score: 0, reasons, pairKey };
  }

  // Rule 4: penalize 1 point per day after day 0, floor at 0.
  const penalty = dayGap * MATCH_RULES.DATE_PENALTY_PER_DAY;
  score = Math.max(0, score - penalty);

  return { score, reasons, pairKey };
};

const meetsThreshold = (result, threshold) =>
  result && result.score >= threshold;

const isDisplayable = (result) =>
  meetsThreshold(result, MATCH_RULES.DISPLAY_THRESHOLD);

const isHighScore = (result) =>
  meetsThreshold(result, MATCH_RULES.HIGH_SCORE_THRESHOLD);

const scorePair = (lostItem, foundItem) => computeMatchScore(lostItem, foundItem);

const buildPairEntry = (lostItem, foundItem) => {
  const result = computeMatchScore(lostItem, foundItem);
  return {
    pairKey: result.pairKey,
    score: result.score,
    reasons: result.reasons,
    lostItem,
    foundItem,
  };
};

const findMatchesForLost = (lostItem, foundItems, options = {}) => {
  if (!lostItem || !Array.isArray(foundItems)) return [];
  const threshold =
    typeof options.minScore === 'number'
      ? options.minScore
      : MATCH_RULES.DISPLAY_THRESHOLD;
  return foundItems
    .map((foundItem) => buildPairEntry(lostItem, foundItem))
    .filter((entry) => entry.score >= threshold)
    .sort((a, b) => b.score - a.score);
};

const findMatchesForFound = (foundItem, lostItems, options = {}) => {
  if (!foundItem || !Array.isArray(lostItems)) return [];
  const threshold =
    typeof options.minScore === 'number'
      ? options.minScore
      : MATCH_RULES.DISPLAY_THRESHOLD;
  return lostItems
    .map((lostItem) => buildPairEntry(lostItem, foundItem))
    .filter((entry) => entry.score >= threshold)
    .sort((a, b) => b.score - a.score);
};

const findHighScorePairs = (lostItems, foundItems) => {
  if (!Array.isArray(lostItems) || !Array.isArray(foundItems)) return [];
  const pairs = [];
  lostItems.forEach((lostItem) => {
    foundItems.forEach((foundItem) => {
      const entry = buildPairEntry(lostItem, foundItem);
      if (isHighScore(entry)) pairs.push(entry);
    });
  });
  return pairs.sort((a, b) => b.score - a.score);
};

module.exports = {
  MATCH_RULES,
  computeMatchScore,
  findMatchesForLost,
  findMatchesForFound,
  findHighScorePairs,
  meetsThreshold,
  isDisplayable,
  isHighScore,
  isLocationMatch,
  getLocationMatchType,
  getDayGap,
  buildPairKey,
  scorePair,
};
