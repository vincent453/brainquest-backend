const express = require('express');
const router = express.Router();
const passport = require('passport');
const {
  signup,
  verifyEmail,
  resendVerificationCode,
  login,
  forgotPassword,
  resetPassword,
  getMe
} = require('../controllers/authController');
const {
  googleCallback,
  googleFailure
} = require('../controllers/googleAuthController');
const { protect } = require('../middleware/auth');

// Regular auth routes
router.post('/signup', signup);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationCode);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.get('/me', protect, getMe);

// Google OAuth routes (only for regular users)
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/api/auth/google/failure',
    session: false 
  }),
  googleCallback
);

router.get('/google/failure', googleFailure);

module.exports = router;