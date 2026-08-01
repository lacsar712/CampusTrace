const asyncHandler = require('express-async-handler');
const LostItem = require('../models/LostItem');
const FoundItem = require('../models/FoundItem');
const MatchDismissal = require('../models/MatchDismissal');
const {
  computeMatchScore,
  meetsDisplayThreshold,
  meetsConflictThreshold,
  buildPairKey,
} = require('../services/matchAssist');

// Build the sorted, threshold-filtered list of found-item candidates for one lost item.
// All scoring / threshold / pairKey concerns are delegated to services/matchAssist.js.
// `dismissedPairKeys` is a Set of pairKeys the current user has marked "Not relevant".
const buildCandidatesForLost = (lostItem, foundItems, dismissedPairKeys = new Set()) => {
  const candidates = [];

  for (const foundItem of foundItems) {
    // Rule 1: categories must match exactly, otherwise the pair is excluded up-front.
    if (lostItem.category !== foundItem.category) continue;

    const pairKey = buildPairKey(lostItem._id, foundItem._id);

    // Per-user isolation: skip pairs this user dismissed. Never affects other users.
    if (dismissedPairKeys.has(pairKey)) continue;

    const { score, reasons } = computeMatchScore(lostItem, foundItem);

    // Rule 5 (+ time-window elimination baked into the score): only >= threshold is visible.
    if (!meetsDisplayThreshold(score)) continue;

    candidates.push({
      pairKey,
      lostItemId: String(lostItem._id),
      foundItemId: String(foundItem._id),
      score,
      reasons,
      foundItem: {
        _id: foundItem._id,
        itemName: foundItem.itemName,
        category: foundItem.category,
        description: foundItem.description,
        image: foundItem.image,
        foundLocation: foundItem.foundLocation,
        dateFound: foundItem.dateFound,
        status: foundItem.status,
      },
    });
  }

  // Highest score first.
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
};

// Found items worth matching against: only those still available to be claimed.
const fetchMatchableFoundItems = (category) =>
  FoundItem.find({ status: 'available', category }).sort({ createdAt: -1 });

// Load the current user's dismissed pairKeys as a Set for O(1) lookups.
const loadDismissedSet = async (userId) => {
  const rows = await MatchDismissal.find({ userId }).select('pairKey');
  return new Set(rows.map((r) => r.pairKey));
};

// @desc    Get possible found-item matches for a single lost item
// @route   GET /api/match/lost/:lostItemId
// @access  Private
const getMatchesForLost = asyncHandler(async (req, res) => {
  const lostItem = await LostItem.findById(req.params.lostItemId);
  if (!lostItem) {
    res.status(404);
    throw new Error('Lost item not found');
  }

  const [foundItems, dismissed] = await Promise.all([
    fetchMatchableFoundItems(lostItem.category),
    loadDismissedSet(req.user._id),
  ]);
  const matches = buildCandidatesForLost(lostItem, foundItems, dismissed);

  res.json({
    lostItemId: String(lostItem._id),
    total: matches.length,
    matches,
  });
});

// @desc    Get possible-match counts for a batch of lost item ids
// @route   POST /api/match/lost/counts
// @access  Private
// @body    { ids: string[] }  → { counts: { [lostItemId]: number } }
const getMatchCounts = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const counts = {};

  if (ids.length === 0) {
    res.json({ counts });
    return;
  }

  const lostItems = await LostItem.find({ _id: { $in: ids } });

  // Preload found items grouped by the categories we actually need.
  const categories = [...new Set(lostItems.map((l) => l.category))];
  const [foundItems, dismissed] = await Promise.all([
    FoundItem.find({ status: 'available', category: { $in: categories } }),
    loadDismissedSet(req.user._id),
  ]);
  const foundByCategory = foundItems.reduce((acc, item) => {
    (acc[item.category] = acc[item.category] || []).push(item);
    return acc;
  }, {});

  for (const lostItem of lostItems) {
    const pool = foundByCategory[lostItem.category] || [];
    counts[String(lostItem._id)] = buildCandidatesForLost(lostItem, pool, dismissed).length;
  }

  res.json({ counts });
});

// @desc    Get match-based suggestions for the current user's active lost items
// @route   GET /api/match/suggestions
// @access  Private
// Conditions: lost item owned by user & status 'active', found item status
// 'available', score >= threshold, and the pair not dismissed by this user.
const getSuggestions = asyncHandler(async (req, res) => {
  const lostItems = await LostItem.find({ ownerId: req.user._id, status: 'active' });

  if (lostItems.length === 0) {
    res.json({ total: 0, suggestions: [] });
    return;
  }

  const categories = [...new Set(lostItems.map((l) => l.category))];
  const [foundItems, dismissed] = await Promise.all([
    FoundItem.find({ status: 'available', category: { $in: categories } }),
    loadDismissedSet(req.user._id),
  ]);
  const foundByCategory = foundItems.reduce((acc, item) => {
    (acc[item.category] = acc[item.category] || []).push(item);
    return acc;
  }, {});

  const suggestions = [];
  for (const lostItem of lostItems) {
    const pool = foundByCategory[lostItem.category] || [];
    const candidates = buildCandidatesForLost(lostItem, pool, dismissed);
    for (const c of candidates) {
      suggestions.push({
        ...c,
        lostItem: {
          _id: lostItem._id,
          itemName: lostItem.itemName,
          category: lostItem.category,
          location: lostItem.location,
          dateLost: lostItem.dateLost,
          status: lostItem.status,
        },
      });
    }
  }

  suggestions.sort((a, b) => b.score - a.score);

  res.json({ total: suggestions.length, suggestions });
});

// @desc    Mark a lost×found pair as "Not relevant" for the current user
// @route   POST /api/match/dismiss
// @access  Private
// @body    { lostItemId, foundItemId }
const dismissMatch = asyncHandler(async (req, res) => {
  const { lostItemId, foundItemId } = req.body;

  if (!lostItemId || !foundItemId) {
    res.status(400);
    throw new Error('lostItemId and foundItemId are required');
  }

  const pairKey = buildPairKey(lostItemId, foundItemId);

  // Idempotent upsert keyed by (userId, pairKey) — dismissing twice is a no-op.
  await MatchDismissal.updateOne(
    { userId: req.user._id, pairKey },
    { $setOnInsert: { userId: req.user._id, pairKey, lostItemId, foundItemId } },
    { upsert: true }
  );

  res.status(201).json({ pairKey, dismissed: true });
});

// @desc    Detect a high-score claim conflict for a found item against OTHER
//          users' active lost items (score >= conflict threshold, i.e. 80).
// @route   GET /api/match/found/:foundItemId/conflict
// @access  Private
// Returns the single highest-scoring conflicting lost item (owned by someone
// other than the requester), or { conflict: null } when none qualifies.
const getClaimConflict = asyncHandler(async (req, res) => {
  const foundItem = await FoundItem.findById(req.params.foundItemId);
  if (!foundItem) {
    res.status(404);
    throw new Error('Found item not found');
  }

  // Only OTHER users' active lost items in the same category are candidates.
  const lostItems = await LostItem.find({
    status: 'active',
    category: foundItem.category,
    ownerId: { $ne: req.user._id },
  }).populate('ownerId', 'name');

  let best = null;
  for (const lostItem of lostItems) {
    const { score } = computeMatchScore(lostItem, foundItem);
    // 80-point judgement delegated to matchAssist — never inlined here.
    if (!meetsConflictThreshold(score)) continue;
    if (!best || score > best.score) {
      best = {
        pairKey: buildPairKey(lostItem._id, foundItem._id),
        lostItemId: String(lostItem._id),
        foundItemId: String(foundItem._id),
        lostItemName: lostItem.itemName,
        score,
      };
    }
  }

  res.json({ conflict: best });
});

// @desc    Admin read-only list of all high-score pairs (score >= 80) where the
//          lost item is still active and the found item is still available.
// @route   GET /api/match/high-pairs
// @access  Private/Admin
const getHighScorePairs = asyncHandler(async (req, res) => {
  const [lostItems, foundItems] = await Promise.all([
    LostItem.find({ status: 'active' }),
    FoundItem.find({ status: 'available' }),
  ]);

  // Group available found items by category to limit comparisons.
  const foundByCategory = foundItems.reduce((acc, item) => {
    (acc[item.category] = acc[item.category] || []).push(item);
    return acc;
  }, {});

  const pairs = [];
  for (const lostItem of lostItems) {
    const pool = foundByCategory[lostItem.category] || [];
    for (const foundItem of pool) {
      const { score, reasons } = computeMatchScore(lostItem, foundItem);
      // 80-point judgement delegated to matchAssist — never inlined here.
      if (!meetsConflictThreshold(score)) continue;
      pairs.push({
        pairKey: buildPairKey(lostItem._id, foundItem._id),
        score,
        reasons,
        lostItemName: lostItem.itemName,
        foundItemName: foundItem.itemName,
        category: lostItem.category,
        lostLocation: lostItem.location,
        foundLocation: foundItem.foundLocation,
      });
    }
  }

  pairs.sort((a, b) => b.score - a.score);
  res.json({ total: pairs.length, pairs });
});

module.exports = {
  getMatchesForLost,
  getMatchCounts,
  getSuggestions,
  dismissMatch,
  getClaimConflict,
  getHighScorePairs,
  buildCandidatesForLost,
};
