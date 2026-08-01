const mongoose = require('mongoose');

const matchDismissalSchema = new mongoose.Schema(
  {
    pairKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
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
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

matchDismissalSchema.index({ pairKey: 1, userId: 1 }, { unique: true });
matchDismissalSchema.index({ userId: 1, lostItemId: 1 });

module.exports = mongoose.model('MatchDismissal', matchDismissalSchema);
