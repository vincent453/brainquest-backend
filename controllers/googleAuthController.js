const User = require('../models/User');
const jwt = require('jsonwebtoken');
const getFrontendBaseUrl = require('../utils/getFrontendBaseUrl');

/**
 * Generate JWT token
 */
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};
 
/**
 * Set JWT token as HTTP-only cookie
 */
const setTokenCookie = (res, token) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  };

  res.cookie('token', token, cookieOptions);

  console.log('🍪 Token cookie set:', {
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite
  });
};

/**
 * Google OAuth callback handler
 */
exports.googleCallback = async (req, res) => {
  const frontendBase = getFrontendBaseUrl(req);

  try {
    console.log('🔵 Google callback triggered');

    const googleUser = req.user;

    if (!googleUser) {
      console.error('❌ No user returned from Google');
      return res.redirect(
        `${frontendBase}/auth/error?message=Authentication failed`
      );
    }

    // Find existing user
    let user = await User.findOne({
      $or: [
        { googleId: googleUser.googleId || googleUser.id },
        { email: googleUser.email.toLowerCase() }
      ]
    });

    let isNewUser = false;

    if (user) {
      console.log('🔵 Existing user found:', user.email);

      if (!user.googleId) {
        user.googleId = googleUser.googleId || googleUser.id;
        user.isEmailVerified = true;
        await user.save();
        console.log('✅ Google ID linked');
      }
    } else {
      isNewUser = true;

      const firstName =
        googleUser.firstName ||
        googleUser.displayName?.split(' ')[0] ||
        'User';

      const lastName =
        googleUser.lastName ||
        googleUser.displayName?.split(' ').slice(1).join(' ') ||
        '';

      user = await User.create({
        firstName,
        lastName,
        email: googleUser.email.toLowerCase(),
        googleId: googleUser.googleId || googleUser.id,
        isEmailVerified: true,
        role: 'user',
        onboardingCompleted: false
      });

      console.log('✅ New Google user created:', user.email);
    }

    // Generate token + set cookie
    const token = generateToken(user._id);
    setTokenCookie(res, token);

    // Redirect based on onboarding
    const redirectUrl =
      !user.onboardingCompleted || isNewUser
        ? `${frontendBase}/onboarding`
        : `${frontendBase}/dashboard`;

    console.log('🔗 Redirecting to:', redirectUrl);
    return res.redirect(redirectUrl);

  } catch (error) {
    console.error('❌ Google callback error:', error);
    return res.redirect(
      `${frontendBase}/auth/error?message=Authentication failed`
    );
  }
};

/**
 * Google OAuth failure handler
 */
exports.googleFailure = (req, res) => {
  const frontendBase = getFrontendBaseUrl(req);

  console.error('❌ Google authentication failed');

  res.redirect(
    `${frontendBase}/auth/error?message=Google authentication failed`
  );
};

/**
 * Get current authenticated user
 */
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          onboardingCompleted: user.onboardingCompleted,
          profilePicture: user.profilePicture
        }
      }
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Logout user
 */
exports.logout = (req, res) => {
  try {
    res.cookie('token', '', {
      httpOnly: true,
      expires: new Date(0),
      path: '/'
    });

    console.log('✅ User logged out');

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
};

module.exports = exports;
