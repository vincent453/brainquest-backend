const jwt = require('jsonwebtoken');
const User = require('../models/User');
// Protect routes - check if user is authenticated
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in cookies FIRST
    if (req.cookies.token) {
      token = req.cookies.token;
    }
    // Fallback to Authorization header (for backward compatibility)
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized to access this route',
        isAuthenticated: false
      });
    }

    try {
      // Verify token
      exports.decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'User not found',
          isAuthenticated: false
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized, token failed',
        isAuthenticated: false
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Check if user is admin
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `User role '${req.user.role}' is not authorized to access this route` 
      });
    }
    next();
  };
};

// Check if email is verified
exports.requireEmailVerification = async (req, res, next) => {
  try {
    if (!req.user.isEmailVerified) {
      return res.status(403).json({ 
        success: false, 
        message: 'Please verify your email before accessing this resource',
        needsVerification: true
      });
    }
    next();
  } catch (error) {
    console.error('Email verification middleware error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Check if onboarding is completed (for regular users)
exports.requireOnboarding = async (req, res, next) => {
  try {
    // Admins don't need onboarding
    if (req.user.role === 'admin') {
      return next();
    }

    if (!req.user.onboardingCompleted) {
      return res.status(403).json({ 
        success: false, 
        message: 'Please complete onboarding before accessing this resource',
        needsOnboarding: true
      });
    }
    next();
  } catch (error) {
    console.error('Onboarding middleware error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

/**
 * Verify JWT token and attach user to request
 */


exports.authenticate = async (req, res, next) => {
  try {
    // 1️⃣ Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1]; // Bearer <token>

    // 2️⃣ Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Use "id" or "userId" depending on your token payload

    // 3️⃣ Find user
    const user = await User.findById(decoded.id).select('-password'); // ✅ token must have { id: user._id }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated.'
      });
    }

    // 4️⃣ Attach user to request
    req.user = user;

    next(); // ✅ pass control to route
  } catch (error) {
    console.error('Authentication error:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired.' });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }

    return res.status(500).json({ success: false, message: 'Authentication failed.' });
  }
};


/**
 * Restrict access to admin users only
 */
exports.requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
  
  next();
};

/**
 * Restrict access to student users only
 */
exports.requireStudent = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }
  
  if (req.user.role !== 'student') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Student access only.'
    });
  }
  
  next();
};

