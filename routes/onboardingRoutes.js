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
// 1️⃣ Authenticated Supabase user (with JIT-provisioned Mongo profile)
// 2️⃣ Verified email (checked via Supabase session, not Mongo)
router.use(authenticate);
router.use(requireEmailVerification);

router.post('/complete', completeOnboarding);
router.get('/status', getOnboardingStatus);
router.get('/check-username/:username', checkUsernameAvailability);

module.exports = router;