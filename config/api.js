export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const API_ENDPOINTS = {
  // Auth
  signup: '/api/auth/signup',
  login: '/api/auth/login',
  verifyEmail: '/api/auth/verify-email',
  resendVerification: '/api/auth/resend-verification',
  forgotPassword: '/api/auth/forgot-password',
  resetPassword: '/api/auth/reset-password',
  getMe: '/api/auth/me',
  googleAuth: '/api/auth/google',
  
  // Onboarding
  completeOnboarding: '/api/onboarding/complete',
  onboardingStatus: '/api/onboarding/status',
  checkUsername: '/api/onboarding/check-username',
};
