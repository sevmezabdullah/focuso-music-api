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
  fileName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
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
  playCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Güncelleme öncesi updatedAt alanını güncelle
trackSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Track', trackSchema);