const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

exports.googleCallback = async (req, res) => {
  try {
    console.log('🔵 Google callback triggered');
    console.log('🔍 req.user data:', JSON.stringify(req.user, null, 2));
    
    const googleUser = req.user;

    if (!googleUser) {
      console.error('❌ No user returned from Google');
      return res.redirect(
        `${process.env.FRONTEND_URL}/auth/google/error?message=Authentication failed`
      );
    }

    // ✅ FIXED: Support both googleUser.googleId and googleUser.id
    let user = await User.findOne({
      $or: [
        { googleId: googleUser.googleId || googleUser.id },
        { email: googleUser.email.toLowerCase() }
      ]
    });

    if (user) {
      console.log('🔵 Existing user:', user.email);
      if (!user.googleId) {
        // ✅ FIXED: Support both googleUser.googleId and googleUser.id
        user.googleId = googleUser.googleId || googleUser.id;
        user.isEmailVerified = true;
        await user.save();
        console.log('✅ Google ID linked to existing user');
      }
    } else {
      const firstName = googleUser.firstName || 
                       googleUser.displayName?.split(' ')[0] || 
                       'User';
      const lastName = googleUser.lastName || 
                      googleUser.displayName?.split(' ').slice(1).join(' ') || 
                      '';

      console.log('🔍 Creating user with:', {
        firstName,
        lastName,
        email: googleUser.email,
        googleId: googleUser.googleId || googleUser.id,
        hasPasswordField: false
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
        console.log('✅ User saved to MongoDB with ID:', user._id);
        console.log('✅ Google ID:', user.googleId);
        
      } catch (createError) {
        console.error('❌ Failed to create user:', createError.message);
        console.error('❌ Error details:', JSON.stringify(createError, null, 2));
        
        return res.redirect(
          `${process.env.FRONTEND_URL}/auth/google/error?message=${encodeURIComponent(createError.message)}`
        );
      }
    }

    // Send token in URL
    const token = generateToken(user._id);
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/google/success?token=${token}&onboarding=${!user.onboardingCompleted}`;
    
    console.log('🔗 Redirecting with token to:', process.env.FRONTEND_URL);
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('❌ Google callback error:', error);
    console.error('❌ Stack trace:', error.stack);
    res.redirect(
      `${process.env.FRONTEND_URL}/auth/google/error?message=Authentication failed`
    );
  }
};

exports.googleFailure = (req, res) => {
  console.error('❌ Google authentication failed');
  res.redirect(
    `${process.env.FRONTEND_URL}/auth/google/error?message=Google authentication failed`
  );
};
