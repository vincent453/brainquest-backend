const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Send token as HTTP-only cookie
const sendTokenResponse = (user, statusCode, res, redirectUrl) => {
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

  // Set cookie and redirect
  res
    .status(statusCode)
    .cookie('token', token, options)
    .redirect(redirectUrl);
};

// @desc    Google OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public
exports.googleCallback = async (req, res) => {
  try {
    console.log('🔵 Google callback triggered');
    
    // req.user is set by passport after successful authentication
    const googleUser = req.user;

    if (!googleUser) {
      console.error('❌ No user data from Google');
      return res.redirect(`${process.env.FRONTEND_URL}/auth/google/error?message=No user data`);
    }

    // Check if user already exists
    let user = await User.findOne({ 
      $or: [
        { googleId: googleUser.id },
        { email: googleUser.email.toLowerCase() }
      ]
    });

    let isNewUser = false;

    if (user) {
      console.log('🔵 Existing user found:', user.email);
      
      // Update Google ID if not set
      if (!user.googleId) {
        user.googleId = googleUser.id;
        user.isEmailVerified = true; // Google already verified the email
        await user.save();
        console.log('🔵 Updated existing user with Google ID');
      }
    } else {
      // Create new user
      isNewUser = true;
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

      console.log('🔵 Created new user:', user.email);
    }

    // Build redirect URL with query params (for user info)
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/google/success?` +
      `firstName=${encodeURIComponent(user.firstName)}&` +
      `lastName=${encodeURIComponent(user.lastName)}&` +
      `email=${encodeURIComponent(user.email)}&` +
      `role=${user.role}&` +
      `onboarding=${!user.onboardingCompleted}&` +
      `isNew=${isNewUser}`;

    // Send token as HTTP-only cookie and redirect
    sendTokenResponse(user, 200, res, redirectUrl);

  } catch (error) {
    console.error('❌ Google callback error:', error);
    const errorUrl = `${process.env.FRONTEND_URL}/auth/google/error?message=Authentication failed`;
    res.redirect(errorUrl);
  }
};

// @desc    Google OAuth failure
// @route   GET /api/auth/google/failure
// @access  Public
exports.googleFailure = (req, res) => {
  console.error('❌ Google authentication failed');
  
  const errorUrl = `${process.env.FRONTEND_URL}/auth/google/error?message=Google authentication cancelled`;
  res.redirect(errorUrl);
};
