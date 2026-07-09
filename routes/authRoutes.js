const express = require('express');
const router = express.Router();

const { getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// ===============================
// 🔐 Auth Routes
// All actual auth (signup, login, Google, verification, password reset)
// is handled client-side via the Supabase Auth SDK.
// This backend only needs to resolve/return the authenticated profile.
// ===============================

// Returns (and JIT-creates if needed) the MongoDB profile for the
// currently authenticated Supabase user.
router.get('/me', authenticate, getMe);

module.exports = router;