const express = require('express');
const router = express.Router();
const {
  getMatchesForLost,
  getMatchCounts,
  getSuggestions,
  dismissMatch,
  getClaimConflict,
  getHighScorePairs,
} = require('../controllers/matchController');
const { protect, isAdmin } = require('../middleware/auth');

// All match endpoints require an authenticated user.
router.post('/lost/counts', protect, getMatchCounts);
router.get('/suggestions', protect, getSuggestions);
router.post('/dismiss', protect, dismissMatch);
router.get('/high-pairs', protect, isAdmin, getHighScorePairs);
router.get('/found/:foundItemId/conflict', protect, getClaimConflict);
router.get('/lost/:lostItemId', protect, getMatchesForLost);

module.exports = router;
