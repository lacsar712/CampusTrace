const mongoose = require('mongoose');

// Per-user "Not relevant" mark on a (lostItem x foundItem) pair.
// The pair is uniquely identified by pairKey: `${lostItemId}__${foundItemId}`.
const matchDismissalSchema = new mongoose.Schema(
  {
    pairKey: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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

// One dismissal per (user, pair)
matchDismissalSchema.index({ pairKey: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('MatchDismissal', matchDismissalSchema);
