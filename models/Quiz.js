const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['multiple-choice', 'true-false', 'short-answer'],
    required: true
  },
  question: {
    type: String,
    required: true
  },
  
  // For multiple choice
  options: [{
    type: String
  }],
  correctAnswer: {
    type: String,
    required: true
  },
  
  // For short answer (alternative acceptable answers)
  acceptableAnswers: [{
    type: String
  }],
  
  // Additional info
  explanation: String,
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  points: {
    type: Number,
    default: 1
  }
});

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  
  // Source information
  sourceResource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resource',
    required: true
  },
  sourceText: String, // Snippet of the source text used
  
  // Quiz questions
  questions: [questionSchema],
  
  // Quiz settings
  totalQuestions: {
    type: Number,
    required: true
  },
  totalPoints: {
    type: Number,
    required: true
  },
  timeLimit: {
    type: Number, // in minutes
    default: null
  },
  passingScore: {
    type: Number, // percentage
    default: 70
  },
  
  // Difficulty distribution
  difficultyDistribution: {
    easy: { type: Number, default: 0 },
    medium: { type: Number, default: 0 },
    hard: { type: Number, default: 0 }
  },
  
  // AI generation metadata
  generatedBy: {
    type: String,
    enum: ['openai', 'anthropic', 'manual'],
    default: 'anthropic'
  },
  generationPrompt: String,
  
  // Access control
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: Date,
  
  // Subject/category
  subject: String,
  tags: [{
    type: String,
    trim: true
  }],
  
  // Statistics
  totalAttempts: {
    type: Number,
    default: 0
  },
  averageScore: {
    type: Number,
    default: 0
  }
  
}, { timestamps: true });

// Calculate total points before saving
quizSchema.pre('save', function(next) {
  if (this.questions && this.questions.length > 0) {
    this.totalQuestions = this.questions.length;
    this.totalPoints = this.questions.reduce((sum, q) => sum + (q.points || 1), 0);
    
    // Calculate difficulty distribution
    this.difficultyDistribution = {
      easy: this.questions.filter(q => q.difficulty === 'easy').length,
      medium: this.questions.filter(q => q.difficulty === 'medium').length,
      hard: this.questions.filter(q => q.difficulty === 'hard').length
    };
  }
  next();
});

// Indexes
quizSchema.index({ createdBy: 1, createdAt: -1 });
quizSchema.index({ sourceResource: 1 });
quizSchema.index({ isPublished: 1 });

module.exports = mongoose.model('Quiz', quizSchema);