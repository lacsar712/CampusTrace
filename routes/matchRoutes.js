const express = require('express');
const router = express.Router();
const {
  getMatchesForLostItem,
  getMatchCounts,
  ignoreMatch,
  unignoreMatch,
  getSuggestions,
  getClaimConflict,
  getHighScorePairs,
} = require('../controllers/matchController');
const { protect, isAdmin } = require('../middleware/auth');

router.use(protect);

router.get('/suggestions', getSuggestions);
router.post('/lost/counts', getMatchCounts);
router.get('/lost/:id', getMatchesForLostItem);
router.get('/found/:id/conflict', getClaimConflict);
router.post('/ignore', ignoreMatch);
router.delete('/ignore/:pairKey', unignoreMatch);
router.get('/admin/pairs', isAdmin, getHighScorePairs);

module.exports = router;
