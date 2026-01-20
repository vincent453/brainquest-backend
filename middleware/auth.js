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
    const authHeader = req.headers.authorization;

    // 1️⃣ Check for token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1];

    // 2️⃣ Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3️⃣ Find user
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

    // 4️⃣ Attach user
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication failed.'
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
