const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../middleware/auth');
const {
  getMatchesForLost,
  getMatchCountsForLost,
  dismissMatch,
  undoDismissMatch,
  getMyMatchSuggestions,
  getFoundClaimConflicts,
  getHighScorePairs,
} = require('../controllers/matchController');

router.use(protect);

router.post('/lost/counts', getMatchCountsForLost);
router.get('/suggestions/mine', getMyMatchSuggestions);
router.get('/found/:id/conflicts', getFoundClaimConflicts);
router.get('/lost/:id', getMatchesForLost);
router.post('/dismiss', dismissMatch);
router.post('/undo-dismiss', undoDismissMatch);

// Admin-only read-only high-score pair board
router.get('/admin/high-score-pairs', isAdmin, getHighScorePairs);

module.exports = router;
