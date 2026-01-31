const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema(
  {
    // Basic info
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    url: {
      type: String,
      trim: true
    },

    // File details
    originalFileName: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      required: true
    },
    filePath: {
      type: String,
      required: true
    },
    fileType: {
      type: String,
      enum: ['pdf', 'image', 'document'],
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },

    // OCR
    extractedText: {
      type: String,
      default: ''
    },
    ocrStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending'
    },
    ocrError: String,

    // Processing flags
    isProcessed: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date,

    // Metadata
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    subject: {
      type: String,
      trim: true
    },
    tags: [
      {
        type: String,
        trim: true
      }
    ],

    // Quiz generation
    quizGenerated: {
      type: Boolean,
      default: false
    },
    generatedQuizzes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz'
      }
    ]
  },
  { timestamps: true }
);

// Indexes
resourceSchema.index({ uploadedBy: 1, createdAt: -1 });
resourceSchema.index({ ocrStatus: 1 });
resourceSchema.index({ isDeleted: 1 });

module.exports = mongoose.model('Resource', resourceSchema);
