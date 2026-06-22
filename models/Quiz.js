const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
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
  }
});

const quizSchema = new mongoose.Schema({
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
  
  // Course Information (NEW)
  courseCode: {
    type: String,
    uppercase: true,
    trim: true,
    index: true
  },
  year: {
    type: String,
    trim: true,
    index: true
  },
  
  // Quiz Type (NEW)
  quizType: {
    type: String,
    enum: ['past-question', 'ai-generated', 'manual', 'hybrid'],
    default: 'ai-generated'
  },
  
  // Questions
  questions: [questionSchema],
  
  // Source
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resource'
  },
  resources: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resource'
  }],
  
  generatedFrom: {
    type: String,
    default: 'AI'
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  
  // Settings
  timeLimit: {
    type: Number, // in minutes
    default: null
  },
  passingScore: {
    type: Number, // percentage
    default: 70
  },
  shuffleQuestions: {
    type: Boolean,
    default: false
  },
  showCorrectAnswers: {
    type: Boolean,
    default: true
  },
  
  // Status
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: Date,
  
  // Statistics
  totalAttempts: {
    type: Number,
    default: 0
  },
  averageScore: {
    type: Number,
    default: 0
  },
  
}, { timestamps: true });

// Calculate total points for the quiz
quizSchema.virtual('totalPoints').get(function() {
  return this.questions.reduce((sum, q) => sum + q.points, 0);
});

// Index for efficient queries
quizSchema.index({ createdBy: 1, createdAt: -1 });
quizSchema.index({ resourceId: 1 });
quizSchema.index({ isPublished: 1 });
quizSchema.index({ courseCode: 1, year: 1 }); // NEW
quizSchema.index({ quizType: 1 }); // NEW

module.exports = mongoose.model('Quiz', quizSchema);
