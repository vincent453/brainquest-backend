const express = require('express');
const router = express.Router();

const {
  completeOnboarding,
  getOnboardingStatus,
  checkUsernameAvailability
} = require('../controllers/onboardingController');

const {
  authenticate,
  requireEmailVerification
} = require('../middleware/auth');

// 🔐 All onboarding routes require:
// 1️⃣ Authenticated user
// 2️⃣ Verified email
router.use(authenticate);
router.use(requireEmailVerification);

// 🚀 Complete onboarding
router.post('/complete', completeOnboarding);

// 📊 Get onboarding status
router.get('/status', getOnboardingStatus);

// 🔎 Check username availability
router.get('/check-username/:username', checkUsernameAvailability);

module.exports = router;
