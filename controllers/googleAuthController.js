const User = require('../models/User');
const jwt = require('jsonwebtoken');

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
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Cross-site in production
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/'
  };

  res.cookie('token', token, cookieOptions);
  console.log('🍪 Token cookie set with options:', {
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    maxAge: cookieOptions.maxAge
  });
};

/**
 * Google OAuth callback handler
 * Sets HTTP-only cookie and redirects to appropriate page
 */
exports.googleCallback = async (req, res) => {
  try {
    console.log('🔵 Google callback triggered');
    console.log('🔍 req.user data:', JSON.stringify(req.user, null, 2));
    
    const googleUser = req.user;

    if (!googleUser) {
      console.error('❌ No user returned from Google');
      return res.redirect(
        `${process.env.FRONTEND_URL}/auth/error?message=Authentication failed`
      );
    }

    // Find or create user
    let user = await User.findOne({
      $or: [
        { googleId: googleUser.googleId || googleUser.id },
        { email: googleUser.email.toLowerCase() }
      ]
    });

    let isNewUser = false;

    if (user) {
      console.log('🔵 Existing user found:', user.email);
      
      // Link Google ID if not already linked
      if (!user.googleId) {
        user.googleId = googleUser.googleId || googleUser.id;
        user.isEmailVerified = true;
        await user.save();
        console.log('✅ Google ID linked to existing user');
      }
    } else {
      // Create new user
      isNewUser = true;
      const firstName = googleUser.firstName || 
                       googleUser.displayName?.split(' ')[0] || 
                       'User';
      const lastName = googleUser.lastName || 
                      googleUser.displayName?.split(' ').slice(1).join(' ') || 
                      '';

      console.log('🔍 Creating new user with:', {
        firstName,
        lastName,
        email: googleUser.email,
        googleId: googleUser.googleId || googleUser.id
      });

      try {
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
        console.log('✅ User ID:', user._id);
        console.log('✅ Google ID:', user.googleId);
        
      } catch (createError) {
        console.error('❌ Failed to create user:', createError.message);
        console.error('❌ Error details:', createError);
        
        return res.redirect(
          `${process.env.FRONTEND_URL}/auth/error?message=${encodeURIComponent(createError.message)}`
        );
      }
    }

    // Generate token and set as HTTP-only cookie
    const token = generateToken(user._id);
    setTokenCookie(res, token);

    // Determine redirect URL based on onboarding status
    let redirectUrl;
    
    if (!user.onboardingCompleted || isNewUser) {
      // New users or users who haven't completed onboarding
      redirectUrl = `${process.env.FRONTEND_URL}/onboarding`;
      console.log('🔗 Redirecting to onboarding (new user or incomplete)');
    } else {
      // Existing users with completed onboarding
      redirectUrl = `${process.env.FRONTEND_URL}/dashboard`;
      console.log('🔗 Redirecting to dashboard (existing user)');
    }
    
    console.log('✅ Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('❌ Google callback error:', error);
    console.error('❌ Stack trace:', error.stack);
    res.redirect(
      `${process.env.FRONTEND_URL}/auth/error?message=Authentication failed`
    );
  }
};

/**
 * Google OAuth failure handler
 */
exports.googleFailure = (req, res) => {
  console.error('❌ Google authentication failed');
  res.redirect(
    `${process.env.FRONTEND_URL}/auth/error?message=Google authentication failed`
  );
};

/**
 * Get current authenticated user (for verifying cookie works)
 * GET /api/auth/me
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
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Logout - clear the token cookie
 * POST /api/auth/logout
 */
exports.logout = (req, res) => {
  try {
    // Clear the token cookie
    res.cookie('token', '', {
      httpOnly: true,
      expires: new Date(0),
      path: '/'
    });

    console.log('✅ User logged out, cookie cleared');

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout',
      error: error.message
    });
  }
};

module.exports = exports;