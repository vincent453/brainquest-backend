const User = require('../models/User');
const jwt = require('jsonwebtoken');

/**
 * Generate JWT
 */
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

/**
 * Send JWT as HTTP-only cookie and redirect
 */
const sendTokenResponse = (user, res, redirectUrl) => {
  const token = generateToken(user._id);

  res
    .cookie('token', token, {
      httpOnly: true,
      secure: true,          // REQUIRED for sameSite:none
      sameSite: 'none',      // Cross-domain cookie
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      path: '/'
    })
    .redirect(redirectUrl);
};

/**
 * @desc    Google OAuth callback
 * @route   GET /api/auth/google/callback
 * @access  Public
 */
exports.googleCallback = async (req, res) => {
  try {
    console.log('🔵 Google callback triggered');

    const googleUser = req.user;

    if (!googleUser) {
      console.error('❌ No user returned from Google');
      return res.redirect(
        `${process.env.FRONTEND_URL}/auth/google/error?message=Authentication failed`
      );
    }

    // Find existing user
    let user = await User.findOne({
      $or: [
        { googleId: googleUser.id },
        { email: googleUser.email.toLowerCase() }
      ]
    });

    if (user) {
      console.log('🔵 Existing user:', user.email);

      // Attach Google ID if missing
      if (!user.googleId) {
        user.googleId = googleUser.id;
        user.isEmailVerified = true;
        await user.save();
      }
    } else {
      // Create new user
      const nameParts = googleUser.displayName?.split(' ') || [];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      user = await User.create({
        firstName,
        lastName,
        email: googleUser.email.toLowerCase(),
        googleId: googleUser.id,
        isEmailVerified: true,
        role: 'user',
        onboardingCompleted: false
      });
      console.log('Google User Data:', googleUser);
      console.log('🆕 New Google user created:', user.email);
    }

    // Redirect back to frontend (NO user data in URL)
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/google/success`;

    sendTokenResponse(user, res, redirectUrl);

  } catch (error) {
    console.error('❌ Google callback error:', error);
    res.redirect(
      `${process.env.FRONTEND_URL}/auth/google/error?message=Authentication failed`
    );
  }
};

/**
 * @desc    Google OAuth failure
 * @route   GET /api/auth/google/failure
 * @access  Public
 */
exports.googleFailure = (req, res) => {
  console.error('❌ Google authentication failed');
  res.redirect(
    `${process.env.FRONTEND_URL}/auth/google/error?message=Google authentication failed`
  );
};


