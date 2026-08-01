const asyncHandler = require('express-async-handler');
const LostItem = require('../models/LostItem');
const FoundItem = require('../models/FoundItem');
const MatchFeedback = require('../models/MatchFeedback');
const { computeMatchScore, buildPairKey, MATCH_RULES } = require('../services/matchAssist');

const getIgnoredPairKeys = async (userId) => {
  const records = await MatchFeedback.find({ userId }).select('pairKey').lean();
  return new Set(records.map((r) => r.pairKey));
};

const evaluateMatches = (lostItem, foundItems, ignoredPairKeys = new Set()) => {
  const results = [];

  for (const found of foundItems) {
    const pairKey = buildPairKey(lostItem._id, found._id);
    if (ignoredPairKeys.has(pairKey)) continue;

    const { score, reasons } = computeMatchScore(lostItem, found);

    const gapMatch = reasons.find((r) => r.startsWith('dateGap:'));
    const gap = gapMatch ? parseInt(gapMatch.split(':')[1], 10) : 0;

    if (gap > MATCH_RULES.MAX_DATE_GAP_DAYS) continue;
    if (score < MATCH_RULES.MIN_SCORE_THRESHOLD) continue;

    results.push({
      pairKey,
      foundItem: found,
      score,
      reasons,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
};

// @desc    Get possible found-item matches for a single lost item
// @route   GET /api/match/lost/:id
// @access  Private
const getMatchesForLostItem = asyncHandler(async (req, res) => {
  const lost = await LostItem.findById(req.params.id);
  if (!lost) {
    res.status(404);
    throw new Error('Lost item not found');
  }

  const foundItems = await FoundItem.find({
    category: lost.category,
    status: 'available',
  }).populate('finderId', 'name email studentId');

  const ignoredPairKeys = await getIgnoredPairKeys(req.user._id);
  const matches = evaluateMatches(lost, foundItems, ignoredPairKeys);

  res.json({
    lostItemId: lost._id,
    total: matches.length,
    matches,
  });
});

// @desc    Get match counts for multiple lost items
// @route   POST /api/match/lost/counts
// @access  Private
const getMatchCounts = asyncHandler(async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids)) {
    res.status(400);
    throw new Error('ids must be an array');
  }

  const lostItems = await LostItem.find({ _id: { $in: ids } });
  const foundItems = await FoundItem.find({ status: 'available' });
  const ignoredPairKeys = await getIgnoredPairKeys(req.user._id);

  const counts = {};
  for (const id of ids) {
    counts[id] = 0;
  }

  for (const lost of lostItems) {
    const candidates = foundItems.filter((f) => f.category === lost.category);
    const matches = evaluateMatches(lost, candidates, ignoredPairKeys);
    counts[lost._id.toString()] = matches.length;
  }

  res.json({ counts });
});

// @desc    Mark a lost/found pair as not relevant for current user
// @route   POST /api/match/ignore
// @access  Private
const ignoreMatch = asyncHandler(async (req, res) => {
  const { lostItemId, foundItemId } = req.body;

  if (!lostItemId || !foundItemId) {
    res.status(400);
    throw new Error('lostItemId and foundItemId are required');
  }

  const pairKey = buildPairKey(lostItemId, foundItemId);

  await MatchFeedback.findOneAndUpdate(
    { userId: req.user._id, pairKey },
    { userId: req.user._id, pairKey, lostItemId, foundItemId },
    { upsert: true, new: true }
  );

  res.status(201).json({ message: 'Pair marked as not relevant', pairKey });
});

// @desc    Remove a "not relevant" mark for current user
// @route   DELETE /api/match/ignore/:pairKey
// @access  Private
const unignoreMatch = asyncHandler(async (req, res) => {
  const { pairKey } = req.params;

  const record = await MatchFeedback.findOneAndDelete({
    userId: req.user._id,
    pairKey,
  });

  if (!record) {
    res.status(404);
    throw new Error('Ignored pair not found');
  }

  res.json({ message: 'Pair unmarked', pairKey });
});

// @desc    Get match suggestions across all of the current user's active lost items
// @route   GET /api/match/suggestions
// @access  Private
const getSuggestions = asyncHandler(async (req, res) => {
  const myLostItems = await LostItem.find({
    ownerId: req.user._id,
    status: 'active',
  });

  const foundItems = await FoundItem.find({ status: 'available' }).populate(
    'finderId',
    'name email studentId'
  );

  const ignoredPairKeys = await getIgnoredPairKeys(req.user._id);

  const suggestions = [];
  for (const lost of myLostItems) {
    const candidates = foundItems.filter((f) => f.category === lost.category);
    const matches = evaluateMatches(lost, candidates, ignoredPairKeys);
    for (const m of matches) {
      suggestions.push({
        ...m,
        lostItem: {
          _id: lost._id,
          itemName: lost.itemName,
          category: lost.category,
          location: lost.location,
          dateLost: lost.dateLost,
        },
      });
    }
  }

  suggestions.sort((a, b) => b.score - a.score);

  res.json({ total: suggestions.length, suggestions });
});

// @desc    Check for high-score conflicts with OTHER users' active lost items when claiming a found item
// @route   GET /api/match/found/:id/conflict
// @access  Private
const getClaimConflict = asyncHandler(async (req, res) => {
  const found = await FoundItem.findById(req.params.id);
  if (!found) {
    res.status(404);
    throw new Error('Found item not found');
  }

  const otherLostItems = await LostItem.find({
    category: found.category,
    status: 'active',
    ownerId: { $ne: req.user._id },
  }).populate('ownerId', 'name email studentId');

  const conflicts = [];
  for (const lost of otherLostItems) {
    const { score, reasons } = computeMatchScore(lost, found);

    const gapMatch = reasons.find((r) => r.startsWith('dateGap:'));
    const gap = gapMatch ? parseInt(gapMatch.split(':')[1], 10) : 0;
    if (gap > MATCH_RULES.MAX_DATE_GAP_DAYS) continue;

    if (score >= MATCH_RULES.HIGH_SCORE_THRESHOLD) {
      conflicts.push({
        pairKey: buildPairKey(lost._id, found._id),
        score,
        reasons,
        lostItem: {
          _id: lost._id,
          itemName: lost.itemName,
          category: lost.category,
          location: lost.location,
          dateLost: lost.dateLost,
          ownerId: lost.ownerId,
        },
      });
    }
  }

  conflicts.sort((a, b) => b.score - a.score);

  res.json({
    foundItemId: found._id,
    hasConflict: conflicts.length > 0,
    threshold: MATCH_RULES.HIGH_SCORE_THRESHOLD,
    conflicts,
  });
});

// @desc    Get all high-score pairs across the system (admin read-only)
// @route   GET /api/match/admin/pairs
// @access  Private/Admin
const getHighScorePairs = asyncHandler(async (req, res) => {
  const [lostItems, foundItems] = await Promise.all([
    LostItem.find({ status: 'active' }).populate('ownerId', 'name email studentId'),
    FoundItem.find({ status: 'available' }).populate('finderId', 'name email studentId'),
  ]);

  const pairs = [];
  for (const lost of lostItems) {
    const candidates = foundItems.filter((f) => f.category === lost.category);
    for (const found of candidates) {
      const { score, reasons } = computeMatchScore(lost, found);

      const gapMatch = reasons.find((r) => r.startsWith('dateGap:'));
      const gap = gapMatch ? parseInt(gapMatch.split(':')[1], 10) : 0;
      if (gap > MATCH_RULES.MAX_DATE_GAP_DAYS) continue;

      if (score >= MATCH_RULES.HIGH_SCORE_THRESHOLD) {
        pairs.push({
          pairKey: buildPairKey(lost._id, found._id),
          score,
          reasons,
          lostItem: {
            _id: lost._id,
            itemName: lost.itemName,
            category: lost.category,
            location: lost.location,
            dateLost: lost.dateLost,
            ownerId: lost.ownerId,
          },
          foundItem: {
            _id: found._id,
            itemName: found.itemName,
            category: found.category,
            foundLocation: found.foundLocation,
            dateFound: found.dateFound,
            finderId: found.finderId,
          },
        });
      }
    }
  }

  pairs.sort((a, b) => b.score - a.score);

  res.json({
    threshold: MATCH_RULES.HIGH_SCORE_THRESHOLD,
    total: pairs.length,
    pairs,
  });
});

module.exports = {
  getMatchesForLostItem,
  getMatchCounts,
  ignoreMatch,
  unignoreMatch,
  getSuggestions,
  getClaimConflict,
  getHighScorePairs,
};
