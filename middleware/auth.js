const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * 🔐 AUTHENTICATE USER (JWT)
 * - Reads token from HTTP-only cookie (preferred) or Authorization header (fallback)
 * - Verifies token
 * - Attaches user to req.user
 */
exports.authenticate = async (req, res, next) => {
  try {
    let token;
    let tokenSource;

    // 1️⃣ Try HTTP-only cookie FIRST (preferred for web clients)
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
      tokenSource = 'cookie';
      console.log('🍪 Token found in HTTP-only cookie');
    }
    // 2️⃣ Fallback to Authorization header (for API clients, mobile apps)
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
      tokenSource = 'header';
      console.log('🔑 Token found in Authorization header');
    }

    // No token found
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      console.error('Token verification error:', error.name);
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Session expired. Please log in again.',
          expired: true
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Please log in again.',
          invalid: true
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'Token verification failed. Please log in again.'
      });
    }

    // Get user from database
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Please log in again.'
      });
    }

    // Check if account is active
    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.',
        deactivated: true
      });
    }

    // Attach user to request
    req.user = user;
    req.tokenSource = tokenSource; // Track where token came from
    
    next();

  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during authentication.',
      error: error.message
    });
  }
};

/**
 * 🛡️ AUTHORIZE ROLES (admin, user, etc.)
 * Usage: authorize('admin') or authorize('admin', 'user')
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`,
        requiredRoles: roles,
        userRole: req.user.role
      });
    }

    next();
  };
};

/**
 * 📧 REQUIRE EMAIL VERIFICATION
 * Ensures user has verified their email address
 */
exports.requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your email address to continue.',
      needsVerification: true,
      email: req.user.email
    });
  }

  next();
};

/**
 * 🚀 REQUIRE ONBOARDING COMPLETION
 * Ensures non-admin users have completed onboarding
 * Admins bypass this check
 */
exports.requireOnboarding = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  // Admins bypass onboarding requirement
  if (req.user.role === 'admin') {
    return next();
  }

  if (!req.user.onboardingCompleted) {
    return res.status(403).json({
      success: false,
      message: 'Please complete the onboarding process to continue.',
      needsOnboarding: true,
      redirectTo: '/onboarding'
    });
  }

  next();
};

/**
 * 🔓 OPTIONAL AUTHENTICATION
 * Attaches user if token exists, but doesn't require it
 * Useful for endpoints that work differently for authenticated vs anonymous users
 */
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;

    // Try cookie first
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // Fallback to header
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    // No token is OK for optional auth
    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (user && user.isActive !== false) {
        req.user = user;
      }
    } catch (error) {
      // Token invalid/expired is OK for optional auth
      console.log('Optional auth: Invalid/expired token, continuing as unauthenticated');
    }

    next();

  } catch (error) {
    console.error('Optional auth middleware error:', error);
    // Continue anyway for optional auth
    next();
  }
};

/**
 * 👤 SELF OR ADMIN
 * Allows users to access their own data or admins to access any data
 * Checks if req.user._id matches req.params.id or user is admin
 */
exports.selfOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  const isAdmin = req.user.role === 'admin';
  const isSelf = req.params.id && req.user._id.toString() === req.params.id;

  if (!isAdmin && !isSelf) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only access your own data.'
    });
  }

  next();
};

/**
 * 🚫 PREVENT AUTHENTICATED ACCESS
 * Blocks already logged-in users from accessing certain routes
 * Useful for login/register pages
 */
exports.preventIfAuthenticated = (req, res, next) => {
  let token;

  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      jwt.verify(token, process.env.JWT_SECRET);
      return res.status(400).json({
        success: false,
        message: 'You are already logged in.',
        alreadyAuthenticated: true
      });
    } catch (error) {
      // Invalid/expired token is fine, continue
    }
  }

  next();
};

module.exports = exports;