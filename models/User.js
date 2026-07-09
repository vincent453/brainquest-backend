const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Link to Supabase Auth
  supabaseUserId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Profile Info
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },

  // Role-based access
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },

  // Onboarding (only for regular users)
  onboardingCompleted: {
    type: Boolean,
    default: false
  },
  username: {
    type: String,
    sparse: true,
    unique: true
  },
  school: String,
  department: String,
  level: String,

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);