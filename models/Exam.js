const mongoose = require('mongoose');

const examQuestionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['multiple-choice', 'true-false', 'short-answer'],
    required: true
  },
  question: {
    type: String,
    required: true,
    trim: true
  },
  options: [{
    type: String,
    trim: true
  }],
  correctAnswer: {
    type: String,
    required: true,
    trim: true
  },
  explanation: {
    type: String,
    trim: true
  },
  points: {
    type: Number,
    default: 1
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  topic: {
    type: String,
    trim: true
  },
  likelihood: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'high',
    description: 'Likelihood of appearing in actual exam'
  }
});

const examSchema = new mongoose.Schema({
  // Basic Info
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  
  // Questions
  questions: [examQuestionSchema],
  
  // Source Resources (Student can upload multiple files)
  resources: [{
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resource'
    },
    fileName: String,
    uploadedAt: Date
  }],
  
  // Owner (Student who created this)
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Metadata
  subject: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  
  // Exam Settings
  examType: {
    type: String,
    enum: ['practice', 'mock', 'prediction'],
    default: 'prediction'
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'mixed'],
    default: 'mixed'
  },
  
  // AI Generation Info
  generatedBy: {
    type: String,
    default: 'AI',
    enum: ['AI', 'Manual', 'Hybrid']
  },
  aiModel: {
    type: String,
    default: 'claude-sonnet-4'
  },
  predictionBasis: {
    type: String,
    default: 'Topic importance and common exam patterns'
  },
  
  // Status
  status: {
    type: String,
    enum: ['generating', 'ready', 'failed'],
    default: 'generating'
  },
  
  // Privacy
  isPrivate: {
    type: Boolean,
    default: true // Student's exams are private by default
  },
  
  // Statistics
  totalAttempts: {
    type: Number,
    default: 0
  },
  lastAttemptedAt: Date,
  averageScore: {
    type: Number,
    default: 0
  },
  
}, { timestamps: true });

// Virtual for total points
examSchema.virtual('totalPoints').get(function() {
  return this.questions.reduce((sum, q) => sum + q.points, 0);
});

// Virtual for question count by likelihood
examSchema.virtual('questionsByLikelihood').get(function() {
  return {
    high: this.questions.filter(q => q.likelihood === 'high').length,
    medium: this.questions.filter(q => q.likelihood === 'medium').length,
    low: this.questions.filter(q => q.likelihood === 'low').length
  };
});

// Index for efficient queries
examSchema.index({ studentId: 1, createdAt: -1 });
examSchema.index({ status: 1 });
examSchema.index({ subject: 1 });

module.exports = mongoose.model('Exam', examSchema);