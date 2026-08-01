const express = require('express');
const router = express.Router();
const {
  getMatchesForLostItem,
  getMatchSummary,
  dismissMatch,
  undismissMatch,
  getMatchSuggestions,
  getMatchConflicts,
  getHighScorePairs,
} = require('../controllers/matchController');
const { protect, isAdmin } = require('../middleware/auth');

router.get('/lost/:lostItemId', protect, getMatchesForLostItem);
router.post('/summary', protect, getMatchSummary);
router.post('/dismiss', protect, dismissMatch);
router.delete('/dismiss/:pairKey', protect, undismissMatch);
router.get('/suggestions', protect, getMatchSuggestions);
router.get('/conflicts/:foundItemId', protect, getMatchConflicts);
router.get('/high-score-pairs', protect, isAdmin, getHighScorePairs);

module.exports = router;
