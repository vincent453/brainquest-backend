const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Info (from signup)
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
  password: {
    type: String,
    required: function() {
      return !this.googleId; // Password not required if using Google OAuth
    }
  },
  
  // Google OAuth
  googleId: {
    type: String,
    sparse: true,
    unique: true
  },
  
  // Role-based access
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  
  // Email verification
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationCode: String,
  emailVerificationExpires: Date,
  
  // Password reset
  passwordResetToken: String,
  passwordResetExpires: Date,
  
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

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate email verification code
userSchema.methods.generateEmailVerificationCode = function() {
  const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
  this.emailVerificationCode = code;
  this.emailVerificationExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
  return code;
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  return token;
};

module.exports = mongoose.model('User', userSchema);