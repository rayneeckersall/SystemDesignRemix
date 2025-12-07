// models/Book.js
const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    bigBookId: { type: Number, required: true },
    title: { type: String, required: true },
    authors: [String],
    coverImageUrl: String,
    averageRating: Number,

    status: {
      type: String,
      enum: ['TBR', 'READ', 'DNF'],
      required: true
    },

    userRating: { type: Number, min: 1, max: 5 },
    userReview: String,
    startedDate: Date,
    finishedDate: Date,

    // future-proof if you ever add users
    userId: { type: String, default: 'rayne' }
  },
  { timestamps: true } // adds createdAt + updatedAt automatically
);

module.exports = mongoose.model('Book', bookSchema);

