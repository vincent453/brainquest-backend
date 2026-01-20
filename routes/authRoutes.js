const express = require('express');
const router = express.Router();
const passport = require('passport');

const {
  signup,
  verifyEmail,
  resendVerificationCode,
  login,
  logout,
  forgotPassword,
  resetPassword,
  getMe
} = require('../controllers/authController');

const {
  googleCallback,
  googleFailure
} = require('../controllers/googleAuthController');

const { authenticate } = require('../middleware/auth');

// ===============================
// 🔐 Regular Auth Routes
// ===============================

router.post('/signup', signup);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationCode);
router.post('/login', login);

router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);

router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// ===============================
// 🔑 Google OAuth Routes
// ===============================

router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false
  })
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
