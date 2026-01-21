const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailService');

// Admin email detection - Add your admin emails here
const ADMIN_EMAILS = [
  'officialbrainquestapp@gmail.com',
  // Add more admin emails
];

const isAdminEmail = (email) => {
  if (ADMIN_EMAILS.includes(email.toLowerCase())) return true;
  return false;
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Send token as HTTP-only cookie
const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  // Create token
  const token = generateToken(user._id);

  // Cookie options
  const options = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true, // Cannot be accessed by JavaScript
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Cross-site in production
    path: '/' // Available on all paths
  };

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      message,
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          onboardingCompleted: user.onboardingCompleted,
          isEmailVerified: user.isEmailVerified
        }
      }
    });
};

// @desc    Register user
// @route   POST /api/auth/signup
// @access  Public
exports.signup = async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required fields' 
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Passwords do not match' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters' 
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already registered' 
      });
    }

    // Determine role based on email
    const role = isAdminEmail(email) ? 'admin' : 'user';

    console.log('📝 Creating user:', email);

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      role
    });

    console.log('✅ User created successfully:', user._id);

    // Generate verification code
    console.log('🔐 Generating verification code...');
    const verificationCode = user.generateEmailVerificationCode();
    
    console.log('💾 Saving verification code to database...');
    await user.save();
    console.log('✅ Verification code saved');

    // Send verification email with detailed error handling
    console.log('📧 Attempting to send verification email to:', user.email);
    
    try {
      // Check if email service is properly configured
      if (!sendVerificationEmail || typeof sendVerificationEmail !== 'function') {
        throw new Error('Email service not properly configured - sendVerificationEmail is not a function');
      }

      await sendVerificationEmail(user.email, verificationCode, user.firstName);
      console.log('✅ Verification email sent successfully');

      res.status(201).json({
        success: true,
        message: 'Registration successful! Please check your email for verification code.',
        data: {
          email: user.email,
          role: user.role
        }
      });

    } catch (emailError) {
      // Email sending failed, but user was created
      console.error('❌ Email sending failed:', emailError);
      console.error('Email error details:', {
        name: emailError.name,
        message: emailError.message,
        stack: emailError.stack
      });

      // Return success with warning about email
      res.status(201).json({
        success: true,
        message: 'Registration successful! However, we could not send the verification email. Please use the resend option.',
        warning: 'Email delivery failed',
        data: {
          email: user.email,
          role: user.role,
          emailError: emailError.message // Include error for debugging
        }
      });
    }

  } catch (error) {
    console.error('❌ Signup error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });

    // More detailed error response
    res.status(500).json({ 
      success: false, 
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: process.env.NODE_ENV === 'development' ? {
        errorType: error.name,
        errorMessage: error.message
      } : undefined
    });
  }
};

// @desc    Verify email with code
// @route   POST /api/auth/verify-email
// @access  Public
exports.verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide email and verification code' 
      });
    }

    console.log('🔍 Verifying email for:', email);
    console.log('🔑 Verification code provided:', code);

    const user = await User.findOne({ 
      email: email.toLowerCase(),
      emailVerificationCode: code,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      console.log('❌ Invalid or expired verification code');
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired verification code' 
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    
    // For admins, mark onboarding as complete
    if (user.role === 'admin') {
      user.onboardingCompleted = true;
    }
    
    await user.save();
    console.log('✅ Email verified successfully');

    // Send token as HTTP-only cookie
    sendTokenResponse(user, 200, res, 'Email verified successfully');

  } catch (error) {
    console.error('❌ Email verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during email verification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Resend verification code
// @route   POST /api/auth/resend-verification
// @access  Public
exports.resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide email' 
      });
    }

    console.log('🔄 Resending verification code to:', email);

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already verified' 
      });
    }

    // Generate new verification code
    const verificationCode = user.generateEmailVerificationCode();
    await user.save();
    console.log('✅ New verification code generated');

    // Send verification email with error handling
    try {
      await sendVerificationEmail(user.email, verificationCode, user.firstName);
      console.log('✅ Verification email resent successfully');

      res.status(200).json({
        success: true,
        message: 'Verification code sent to your email'
      });

    } catch (emailError) {
      console.error('❌ Failed to resend verification email:', emailError);
      
      res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again later.',
        error: process.env.NODE_ENV === 'development' ? emailError.message : undefined
      });
    }

  } catch (error) {
    console.error('❌ Resend verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while resending verification code',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide email and password' 
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user || !user.password) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(403).json({ 
        success: false, 
        message: 'Please verify your email before logging in',
        needsVerification: true
      });
    }

    // Send token as HTTP-only cookie
    sendTokenResponse(user, 200, res, 'Login successful');

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    res
      .status(200)
      .cookie('token', 'none', {
        expires: new Date(Date.now() + 1000), // Expire in 1 second
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
      })
      .json({
        success: true,
        message: 'Logged out successfully'
      });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during logout' 
    });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide email' 
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'No user found with this email' 
      });
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Send email with error handling
    try {
      await sendPasswordResetEmail(user.email, resetUrl, user.firstName);
      console.log('✅ Password reset email sent');

      res.status(200).json({
        success: true,
        message: 'Password reset link sent to your email'
      });

    } catch (emailError) {
      console.error('❌ Failed to send password reset email:', emailError);
      
      // Rollback the reset token
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      res.status(500).json({
        success: false,
        message: 'Failed to send password reset email. Please try again later.',
        error: process.env.NODE_ENV === 'development' ? emailError.message : undefined
      });
    }

  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while processing password reset',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const { token } = req.params;

    if (!password || !confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide password and confirm password' 
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Passwords do not match' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters' 
      });
    }

    // Hash token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired reset token' 
      });
    }

    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.'
    });

  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while resetting password',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('❌ Get me error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};