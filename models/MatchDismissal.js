const mongoose = require('mongoose');

// Persists a user's "Not relevant" mark for a specific lost×found pair.
// The pair is identified by the project-wide canonical pairKey
// (`${lostItemId}__${foundItemId}`) so dismissals are keyed identically
// everywhere. Dismissals are per-user: the compound unique index on
// { userId, pairKey } guarantees one row per user per pair and keeps one
// user's dismissals invisible to everyone else.
const matchDismissalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Canonical pairKey: `${lostItemId}__${foundItemId}` — the stored unique key for the pair.
    pairKey: {
      type: String,
      required: true,
      trim: true,
    },
    lostItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LostItem',
      required: true,
    },
    foundItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoundItem',
      required: true,
    },
  },
  { timestamps: true }
);

// One dismissal per user per pair; also the query index for per-user filtering.
matchDismissalSchema.index({ userId: 1, pairKey: 1 }, { unique: true });

module.exports = mongoose.model('MatchDismissal', matchDismissalSchema);
