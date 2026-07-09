const supabaseAdmin = require('../utils/supabaseAdmin');
const User = require('../models/User');

/**
 * 🔐 AUTHENTICATE USER (Supabase)
 * - Reads Bearer token from Authorization header
 * - Verifies it against Supabase Auth
 * - Finds (or creates) the matching MongoDB profile
 * - Attaches the MongoDB profile to req.user
 * - Attaches the raw Supabase user to req.supabaseUser (for email_confirmed_at, etc.)
 */
exports.authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify the token with Supabase
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session. Please log in again.',
        expired: true
      });
    }

    const supabaseUser = data.user;

    // Find matching MongoDB profile
    let user = await User.findOne({ supabaseUserId: supabaseUser.id });

    // JIT provisioning: first time this Supabase user has hit our API
    if (!user) {
      const metadata = supabaseUser.user_metadata || {};
      const fullName = metadata.full_name || metadata.name || '';
      const [metaFirst, ...metaRest] = fullName.split(' ');

      user = await User.create({
        supabaseUserId: supabaseUser.id,
        email: (supabaseUser.email || '').toLowerCase(),
        firstName: metadata.first_name || metaFirst || 'User',
        lastName: metadata.last_name || metaRest.join(' ') || '',
        role: 'user',
        onboardingCompleted: false
      });

      console.log('✅ New MongoDB profile created for Supabase user:', supabaseUser.id);
    }

    req.user = user;
    req.supabaseUser = supabaseUser;

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
 * 🛡️ AUTHORIZE ROLES — unchanged, still reads req.user.role from MongoDB
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
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
 * Now reads verification status from the Supabase user object,
 * since MongoDB no longer stores this.
 */
exports.requireEmailVerification = (req, res, next) => {
  if (!req.user || !req.supabaseUser) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  if (!req.supabaseUser.email_confirmed_at) {
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
 * 🚀 REQUIRE ONBOARDING COMPLETION — unchanged
 */
exports.requireOnboarding = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

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
 * Attaches user if a valid Supabase token is present, but doesn't require it.
 */
exports.optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (!error && data?.user) {
      const user = await User.findOne({ supabaseUserId: data.user.id });
      if (user) {
        req.user = user;
        req.supabaseUser = data.user;
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next();
  }
};

/**
 * 👤 SELF OR ADMIN — unchanged
 */
exports.selfOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
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

module.exports = exports;