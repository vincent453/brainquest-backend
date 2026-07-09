// @desc    Get current authenticated user's profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    // req.user was already resolved (and JIT-created if needed) by the auth middleware
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          supabaseUserId: req.user.supabaseUserId,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          email: req.user.email,
          username: req.user.username,
          school: req.user.school,
          department: req.user.department,
          level: req.user.level,
          role: req.user.role,
          onboardingCompleted: req.user.onboardingCompleted,
          emailVerified: !!req.supabaseUser?.email_confirmed_at
        }
      }
    });
  } catch (error) {
    console.error('❌ Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = exports;