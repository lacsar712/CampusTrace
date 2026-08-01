const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const LostItem = require('../models/LostItem');
const FoundItem = require('../models/FoundItem');
const MatchDismissal = require('../models/MatchDismissal');
const {
  findMatchesForLost,
  findMatchesForFound,
  findHighScorePairs,
  MATCH_RULES,
  buildPairKey,
} = require('../services/matchAssist');

const PAIR_KEY_SEPARATOR = '__';

const parsePairKey = (pairKey) => {
  if (!pairKey || typeof pairKey !== 'string') return null;
  const parts = pairKey.split(PAIR_KEY_SEPARATOR);
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  if (!mongoose.Types.ObjectId.isValid(parts[0])) return null;
  if (!mongoose.Types.ObjectId.isValid(parts[1])) return null;
  return { lostItemId: parts[0], foundItemId: parts[1] };
};

const getDismissedPairKeys = async (userId, lostItemIds = null) => {
  const query = { userId };
  if (Array.isArray(lostItemIds) && lostItemIds.length > 0) {
    query.lostItemId = { $in: lostItemIds };
  }
  const records = await MatchDismissal.find(query).select('pairKey').lean();
  return new Set(records.map((r) => r.pairKey));
};

const getMatchesForLost = asyncHandler(async (req, res) => {
  const lostItem = await LostItem.findById(req.params.id);
  if (!lostItem) {
    res.status(404);
    throw new Error('Lost item not found');
  }

  const limit = req.query.limit ? Math.max(1, parseInt(req.query.limit, 10)) : 0;

  const [foundItems, dismissedSet] = await Promise.all([
    FoundItem.find({ status: 'available' })
      .populate('finderId', 'name email studentId')
      .sort({ createdAt: -1 }),
    getDismissedPairKeys(req.user._id, [lostItem._id]),
  ]);

  let matches = findMatchesForLost(lostItem, foundItems).filter(
    (entry) => !dismissedSet.has(entry.pairKey)
  );
  if (limit > 0) {
    matches = matches.slice(0, limit);
  }

  res.json({
    lostItemId: lostItem._id,
    count: matches.length,
    threshold: MATCH_RULES.DISPLAY_THRESHOLD,
    matches,
  });
});

const getMatchCountsForLost = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body.ids)
    ? req.body.ids
    : Array.isArray(req.query.ids)
      ? req.query.ids
      : typeof req.query.ids === 'string'
        ? req.query.ids.split(',').filter(Boolean)
        : [];

  if (ids.length === 0) {
    return res.json({ counts: {} });
  }

  const [lostItems, foundItems, dismissedSet] = await Promise.all([
    LostItem.find({ _id: { $in: ids } }),
    FoundItem.find({ status: 'available' }).select(
      'itemName category foundLocation dateFound status image finderId createdAt'
    ),
    getDismissedPairKeys(req.user._id, ids),
  ]);

  const counts = {};
  lostItems.forEach((lostItem) => {
    const matches = findMatchesForLost(lostItem, foundItems).filter(
      (entry) => !dismissedSet.has(entry.pairKey)
    );
    counts[lostItem._id.toString()] = matches.length;
  });

  ids.forEach((id) => {
    if (counts[id] === undefined) counts[id] = 0;
  });

  res.json({ counts });
});

const dismissMatch = asyncHandler(async (req, res) => {
  const { pairKey } = req.body;
  const parsed = parsePairKey(pairKey);
  if (!parsed) {
    res.status(400);
    throw new Error('Invalid pairKey format');
  }

  const [lostItem, foundItem] = await Promise.all([
    LostItem.findById(parsed.lostItemId),
    FoundItem.findById(parsed.foundItemId),
  ]);

  if (!lostItem) {
    res.status(404);
    throw new Error('Lost item not found');
  }
  if (!foundItem) {
    res.status(404);
    throw new Error('Found item not found');
  }

  const canonicalPairKey = buildPairKey(
    parsed.lostItemId,
    parsed.foundItemId
  );

  await MatchDismissal.updateOne(
    { pairKey: canonicalPairKey, userId: req.user._id },
    {
      $set: {
        pairKey: canonicalPairKey,
        lostItemId: parsed.lostItemId,
        foundItemId: parsed.foundItemId,
        userId: req.user._id,
      },
    },
    { upsert: true }
  );

  res.json({ message: 'Pair marked as not relevant', pairKey: canonicalPairKey });
});

const undoDismissMatch = asyncHandler(async (req, res) => {
  const { pairKey } = req.body;
  const parsed = parsePairKey(pairKey);
  if (!parsed) {
    res.status(400);
    throw new Error('Invalid pairKey format');
  }

  const canonicalPairKey = buildPairKey(
    parsed.lostItemId,
    parsed.foundItemId
  );

  await MatchDismissal.deleteOne({
    pairKey: canonicalPairKey,
    userId: req.user._id,
  });

  res.json({ message: 'Pair restored', pairKey: canonicalPairKey });
});

const getMyMatchSuggestions = asyncHandler(async (req, res) => {
  const [myLostItems, foundItems, dismissedSet] = await Promise.all([
    LostItem.find({ ownerId: req.user._id, status: 'active' }),
    FoundItem.find({ status: 'available' })
      .populate('finderId', 'name email studentId')
      .sort({ createdAt: -1 }),
    getDismissedPairKeys(req.user._id),
  ]);

  const suggestions = [];
  myLostItems.forEach((lostItem) => {
    const matches = findMatchesForLost(lostItem, foundItems).filter(
      (entry) => !dismissedSet.has(entry.pairKey)
    );
    matches.forEach((entry) => {
      suggestions.push({
        pairKey: entry.pairKey,
        score: entry.score,
        reasons: entry.reasons,
        lostItem,
        foundItem: entry.foundItem,
      });
    });
  });

  suggestions.sort((a, b) => b.score - a.score);

  res.json({
    count: suggestions.length,
    threshold: MATCH_RULES.DISPLAY_THRESHOLD,
    suggestions,
  });
});

// High-score (>= 80) active lost items belonging to OTHER users that match
// this available found item. Used by the claim modal as a non-blocking warning.
const getFoundClaimConflicts = asyncHandler(async (req, res) => {
  const foundItem = await FoundItem.findById(req.params.id);
  if (!foundItem) {
    res.status(404);
    throw new Error('Found item not found');
  }

  const otherLostItems = await LostItem.find({
    status: 'active',
    ownerId: { $ne: req.user._id },
  }).populate('ownerId', 'name email studentId');

  const conflicts = findMatchesForFound(foundItem, otherLostItems, {
    minScore: MATCH_RULES.HIGH_SCORE_THRESHOLD,
  });

  res.json({
    foundItemId: foundItem._id,
    threshold: MATCH_RULES.HIGH_SCORE_THRESHOLD,
    count: conflicts.length,
    conflicts,
  });
});

// Admin-only read-only list of every pair scoring >= 80 where the lost
// item is still active and the found item is still available.
const getHighScorePairs = asyncHandler(async (req, res) => {
  const [lostItems, foundItems] = await Promise.all([
    LostItem.find({ status: 'active' }).populate('ownerId', 'name email studentId'),
    FoundItem.find({ status: 'available' }).populate(
      'finderId',
      'name email studentId'
    ),
  ]);

  const pairs = findHighScorePairs(lostItems, foundItems);

  res.json({
    count: pairs.length,
    threshold: MATCH_RULES.HIGH_SCORE_THRESHOLD,
    pairs,
  });
});

module.exports = {
  getMatchesForLost,
  getMatchCountsForLost,
  dismissMatch,
  undoDismissMatch,
  getMyMatchSuggestions,
  getFoundClaimConflicts,
  getHighScorePairs,
};
