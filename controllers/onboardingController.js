const User = require('../models/User');

// @desc    Complete onboarding (only for regular users)
// @route   POST /api/onboarding/complete
// @access  Private
exports.completeOnboarding = async (req, res) => {
  try {
    const { username, school, department, level } = req.body;
    const userId = req.user.id;

    // Get user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Only regular users can complete onboarding
    if (user.role !== 'user') {
      return res.status(403).json({ 
        success: false, 
        message: 'Onboarding is only for regular users' 
      });
    }

    // Check if already completed
    if (user.onboardingCompleted) {
      return res.status(400).json({ 
        success: false, 
        message: 'Onboarding already completed' 
      });
    }

    // Validation
    if (!username || !school || !department || !level) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required fields: username, school, department, level' 
      });
    }

    // Check if username is already taken
    const existingUsername = await User.findOne({ 
      username: username.toLowerCase(),
      _id: { $ne: userId }
    });

    if (existingUsername) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username already taken' 
      });
    }

    // Update user with onboarding data
    user.username = username.toLowerCase();
    user.school = school;
    user.department = department;
    user.level = level;
    user.onboardingCompleted = true;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Onboarding completed successfully',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          username: user.username,
          school: user.school,
          department: user.department,
          level: user.level,
          role: user.role,
          onboardingCompleted: user.onboardingCompleted
        }
      }
    });

  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during onboarding' 
    });
  }
};

// @desc    Get onboarding status
// @route   GET /api/onboarding/status
// @access  Private
exports.getOnboardingStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.status(200).json({
      success: true,
      data: {
        onboardingCompleted: user.onboardingCompleted,
        role: user.role,
        needsOnboarding: user.role === 'user' && !user.onboardingCompleted
      }
    });

  } catch (error) {
    console.error('Get onboarding status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// @desc    Check username availability
// @route   GET /api/onboarding/check-username/:username
// @access  Private
exports.checkUsernameAvailability = async (req, res) => {
  try {
    const { username } = req.params;

    if (!username || username.length < 3) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username must be at least 3 characters' 
      });
    }

    const existingUser = await User.findOne({ 
      username: username.toLowerCase() 
    });

    res.status(200).json({
      success: true,
      available: !existingUser,
      message: existingUser ? 'Username already taken' : 'Username available'
    });

  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};