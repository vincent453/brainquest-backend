const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// @desc    Google OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public
exports.googleCallback = async (req, res) => {
  try {
    // req.user is set by passport after successful authentication
    const googleUser = req.user;

    // Check if user already exists
    let user = await User.findOne({ 
      $or: [
        { googleId: googleUser.id },
        { email: googleUser.email.toLowerCase() }
      ]
    });

    if (user) {
      // Update Google ID if not set
      if (!user.googleId) {
        user.googleId = googleUser.id;
        user.isEmailVerified = true; // Google already verified the email
        await user.save();
      }
    } else {
      // Create new user
      const nameParts = googleUser.displayName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      user = await User.create({
        firstName,
        lastName,
        email: googleUser.email.toLowerCase(),
        googleId: googleUser.id,
        isEmailVerified: true, // Google already verified
        role: 'user', // Google OAuth only for regular users
        onboardingCompleted: false
      });
    }

    // Generate token
    const token = generateToken(user._id);

    // Redirect to frontend with token
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/google/success?token=${token}&onboarding=${!user.onboardingCompleted}`;
    
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('Google callback error:', error);
    const errorUrl = `${process.env.FRONTEND_URL}/auth/google/error?message=Authentication failed`;
    res.redirect(errorUrl);
  }
};

// @desc    Google OAuth failure
// @route   GET /api/auth/google/failure
// @access  Public
exports.googleFailure = (req, res) => {
  res.status(401).json({
    success: false,
    message: 'Google authentication failed'
  });
};