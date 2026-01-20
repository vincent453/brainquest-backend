const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  question: String,
  studentAnswer: {
    type: String,
    required: true
  },
  correctAnswer: String,
  isCorrect: {
    type: Boolean,
    required: true
  },
  pointsAwarded: {
    type: Number,
    default: 0
  }
});

const quizAttemptSchema = new mongoose.Schema({
  // Quiz and user references
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Attempt details
  answers: [answerSchema],
  
  // Scoring
  score: {
    type: Number,
    required: true
  },
  totalPoints: {
    type: Number,
    required: true
  },
  percentage: {
    type: Number,
    required: true
  },
  passed: {
    type: Boolean,
    required: true
  },
  
  // Timing
  startedAt: {
    type: Date,
    required: true
  },
  completedAt: {
    type: Date,
    required: true
  },
  timeTaken: {
    type: Number, // in seconds
    required: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'abandoned'],
    default: 'completed'
  },
  
  // Feedback
  feedback: String
  
}, { timestamps: true });

// Calculate percentage and passed status before saving
quizAttemptSchema.pre('save', function(next) {
  if (this.score !== undefined && this.totalPoints > 0) {
    this.percentage = Math.round((this.score / this.totalPoints) * 100);
  }
  next();
});

// Indexes
quizAttemptSchema.index({ student: 1, quiz: 1, createdAt: -1 });
quizAttemptSchema.index({ quiz: 1, createdAt: -1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);