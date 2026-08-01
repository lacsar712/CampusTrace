const mongoose = require('mongoose');

const matchFeedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
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

matchFeedbackSchema.index({ userId: 1, pairKey: 1 }, { unique: true });

module.exports = mongoose.model('MatchFeedback', matchFeedbackSchema);
