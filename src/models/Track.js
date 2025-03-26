const mongoose = require('mongoose');

const trackSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  artist: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  coverImage: {
    type: String
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  category: {
    type: String,
    enum: ['focus', 'meditation', 'ambient', 'nature'],
    required: true
  },
  tags: [{
    type: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Track', trackSchema);