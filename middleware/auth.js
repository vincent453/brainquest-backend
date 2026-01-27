const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * 🔐 AUTHENTICATE USER (JWT)
 * - Reads token from Authorization header
 * - Verifies token
 * - Attaches user to req.user
 */
exports.authenticate = async (req, res, next) => {
  try {
    let token;

    // 1️⃣ Try Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    // 2️⃣ Fallback to HTTP-only cookie
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error.name);

    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.'
    });
  }
};

/**
 * 🛡️ AUTHORIZE ROLES (admin, student, etc.)
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
        message: `Role '${req.user.role}' is not allowed to access this route.`
      });
    }

    next();
  };
};

/**
 * 📧 REQUIRE EMAIL VERIFICATION
 */
exports.requireEmailVerification = (req, res, next) => {
  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your email.',
      needsVerification: true
    });
  }

  next();
};

/**
 * 🚀 REQUIRE ONBOARDING (non-admins)
 */
exports.requireOnboarding = (req, res, next) => {
  if (req.user.role === 'admin') return next();

  if (!req.user.onboardingCompleted) {
    return res.status(403).json({
      success: false,
      message: 'Please complete onboarding.',
      needsOnboarding: true
    });
  }

  next();
};
