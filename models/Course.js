const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  // Course Info
  courseCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  courseName: {
    type: String,
    required: true,
    trim: true
  },
  department: {
    type: String,
    trim: true,
    index: true
  },
  level: {
    type: String,
    enum: ['100', '200', '300', '400', '500'],
    index: true
  },
  
  // Available Resources
  availableYears: [{
    type: String,
    trim: true
  }],
  
  // Past Questions
  pastQuestions: [{
    year: String,
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz'
    },
    questionCount: Number,
    uploadedAt: Date,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Topic Analysis (for pattern matching)
  commonTopics: [{
    topic: String,
    frequency: Number, // How often it appears (0-100%)
    importance: {
      type: String,
      enum: ['high', 'medium', 'low']
    }
  }],
  
  // Question Patterns
  questionPatterns: {
    multipleChoice: {
      type: Number,
      default: 0 // Percentage
    },
    trueFalse: {
      type: Number,
      default: 0
    },
    shortAnswer: {
      type: Number,
      default: 0
    }
  },
  
  // Difficulty Distribution
  difficultyDistribution: {
    easy: {
      type: Number,
      default: 0 // Percentage
    },
    medium: {
      type: Number,
      default: 0
    },
    hard: {
      type: Number,
      default: 0
    }
  },
  
  // Statistics
  totalQuizzes: {
    type: Number,
    default: 0
  },
  totalAttempts: {
    type: Number,
    default: 0
  },
  averageScore: {
    type: Number,
    default: 0
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Metadata
  description: String,
  tags: [String],
  
}, { timestamps: true });

// Index for efficient searches
courseSchema.index({ courseCode: 1, 'availableYears': 1 });
courseSchema.index({ department: 1, level: 1 });

// Method to check if course has past questions for a year
courseSchema.methods.hasPastQuestions = function(year) {
  return this.availableYears.includes(year);
};

// Method to get pattern confidence
courseSchema.methods.getPatternConfidence = function() {
  if (this.totalQuizzes === 0) return 0;
  if (this.totalQuizzes < 3) return 30; // Low confidence
  if (this.totalQuizzes < 5) return 60; // Medium confidence
  return 90; // High confidence
};

module.exports = mongoose.model('Course', courseSchema);