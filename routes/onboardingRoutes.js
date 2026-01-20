const express = require('express');
const router = express.Router();
const {
  completeOnboarding,
  getOnboardingStatus,
  checkUsernameAvailability
} = require('../controllers/onboardingController');
const { protect, requireEmailVerification } = require('../middleware/auth');

// All onboarding routes require authentication and email verification
router.use(protect);
router.use(requireEmailVerification);

router.post('/complete', completeOnboarding);
router.get('/status', getOnboardingStatus);
router.get('/check-username/:username', checkUsernameAvailability);

module.exports = router;