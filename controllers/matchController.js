const asyncHandler = require('express-async-handler');
const LostItem = require('../models/LostItem');
const FoundItem = require('../models/FoundItem');
const MatchDismissal = require('../models/MatchDismissal');
const { buildMatches, computeMatchScore, getPairKey, MATCH_RULES } = require('../services/matchAssist');

// Dismissed pairKeys for the current user (per-user "Not relevant" marks)
const getDismissedPairKeys = async (userId) => {
  const dismissals = await MatchDismissal.find({ userId }).select('pairKey');
  return new Set(dismissals.map((d) => d.pairKey));
};

// @desc    Get possible found-item matches for a lost item (score >= threshold,
//          excluding pairs the current user marked as not relevant)
// @route   GET /api/match/lost/:lostItemId
// @access  Private
const getMatchesForLostItem = asyncHandler(async (req, res) => {
  const lostItem = await LostItem.findById(req.params.lostItemId);

  if (!lostItem) {
    res.status(404);
    throw new Error('Lost item not found');
  }

  const [foundItems, dismissed] = await Promise.all([
    FoundItem.find({}).populate('finderId', 'name email studentId'),
    getDismissedPairKeys(req.user._id),
  ]);

  const matches = buildMatches(lostItem, foundItems).filter(
    (match) => !dismissed.has(match.pairKey)
  );

  res.json({ lostItemId: lostItem._id, total: matches.length, matches });
});

// @desc    Get match counts for a batch of lost items (for dashboard badges)
// @route   POST /api/match/summary
// @access  Private
const getMatchSummary = asyncHandler(async (req, res) => {
  const { lostIds } = req.body;

  if (!Array.isArray(lostIds) || lostIds.length === 0) {
    res.status(400);
    throw new Error('lostIds must be a non-empty array');
  }

  const [lostItems, foundItems, dismissed] = await Promise.all([
    LostItem.find({ _id: { $in: lostIds } }),
    FoundItem.find({}),
    getDismissedPairKeys(req.user._id),
  ]);

  const counts = {};
  for (const lostItem of lostItems) {
    counts[lostItem._id.toString()] = buildMatches(lostItem, foundItems).filter(
      (match) => !dismissed.has(match.pairKey)
    ).length;
  }

  res.json({ counts });
});

// @desc    Mark a (lostItem x foundItem) pair as not relevant for current user
// @route   POST /api/match/dismiss
// @access  Private
const dismissMatch = asyncHandler(async (req, res) => {
  const { pairKey } = req.body;

  if (!pairKey || typeof pairKey !== 'string' || !pairKey.includes('__')) {
    res.status(400);
    throw new Error('A valid pairKey (${lostItemId}__${foundItemId}) is required');
  }

  const [lostItemId, foundItemId] = pairKey.split('__');

  const dismissal = await MatchDismissal.findOneAndUpdate(
    { pairKey, userId: req.user._id },
    { pairKey, userId: req.user._id, lostItemId, foundItemId },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(201).json(dismissal);
});

// @desc    Remove a not-relevant mark for the current user
// @route   DELETE /api/match/dismiss/:pairKey
// @access  Private
const undismissMatch = asyncHandler(async (req, res) => {
  const result = await MatchDismissal.findOneAndDelete({
    pairKey: req.params.pairKey,
    userId: req.user._id,
  });

  if (!result) {
    res.status(404);
    throw new Error('Dismissal not found');
  }

  res.json({ message: 'Dismissal removed successfully' });
});

// @desc    Suggested matches for the current user: their own active lost items
//          x still-available found items, above threshold, not dismissed
// @route   GET /api/match/suggestions
// @access  Private
const getMatchSuggestions = asyncHandler(async (req, res) => {
  const [lostItems, foundItems, dismissed] = await Promise.all([
    LostItem.find({ ownerId: req.user._id, status: 'active' }),
    FoundItem.find({ status: 'available' }),
    getDismissedPairKeys(req.user._id),
  ]);

  const suggestions = [];
  for (const lostItem of lostItems) {
    for (const match of buildMatches(lostItem, foundItems)) {
      if (dismissed.has(match.pairKey)) continue;
      suggestions.push({ ...match, lostItem });
    }
  }

  suggestions.sort((a, b) => b.score - a.score);

  res.json({ total: suggestions.length, suggestions });
});

// @desc    High-score conflicts for a found item: active lost items owned by
//          OTHER users scoring >= HIGH_SCORE_THRESHOLD (claim conflict hint)
// @route   GET /api/match/conflicts/:foundItemId
// @access  Private
const getMatchConflicts = asyncHandler(async (req, res) => {
  const foundItem = await FoundItem.findById(req.params.foundItemId);

  if (!foundItem) {
    res.status(404);
    throw new Error('Found item not found');
  }

  const [lostItems, dismissed] = await Promise.all([
    LostItem.find({ status: 'active' }),
    getDismissedPairKeys(req.user._id),
  ]);

  const conflicts = lostItems
    .filter((lostItem) => lostItem.ownerId.toString() !== req.user._id.toString())
    .map((lostItem) => ({
      pairKey: getPairKey(lostItem._id, foundItem._id),
      ...computeMatchScore(lostItem, foundItem),
      lostItem,
    }))
    .filter(
      (conflict) =>
        conflict.score >= MATCH_RULES.HIGH_SCORE_THRESHOLD && !dismissed.has(conflict.pairKey)
    )
    .sort((a, b) => b.score - a.score);

  res.json({ foundItemId: foundItem._id, total: conflicts.length, conflicts });
});

// @desc    All high-score pairs in the system (score >= HIGH_SCORE_THRESHOLD,
//          lost item active, found item available) - admin read-only panel
// @route   GET /api/match/high-score-pairs
// @access  Private/Admin
const getHighScorePairs = asyncHandler(async (req, res) => {
  const [lostItems, foundItems] = await Promise.all([
    LostItem.find({ status: 'active' }),
    FoundItem.find({ status: 'available' }),
  ]);

  const pairs = [];
  for (const lostItem of lostItems) {
    for (const match of buildMatches(lostItem, foundItems)) {
      if (match.score >= MATCH_RULES.HIGH_SCORE_THRESHOLD) {
        pairs.push({ ...match, lostItem });
      }
    }
  }

  pairs.sort((a, b) => b.score - a.score);

  res.json({ total: pairs.length, pairs });
});

module.exports = {
  getMatchesForLostItem,
  getMatchSummary,
  dismissMatch,
  undismissMatch,
  getMatchSuggestions,
  getMatchConflicts,
  getHighScorePairs,
};
