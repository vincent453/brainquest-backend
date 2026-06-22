// ========================================
// ADMIN ROUTES (Past Questions)
// ========================================
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const adminController = require('../controllers/Adminpastquestioncontroller');
const upload = require('../middleware/upload');

/**
 * @route   POST /api/admin/past-questions/bulk-upload
 * @desc    Admin uploads multiple past question papers
 * @access  Admin only
 */
router.post(
  '/past-questions/bulk-upload',
  authenticate,
  authorize('admin'),
  upload.array('files', 10), // Max 10 files
  adminController.bulkUploadPastQuestions
);

/**
 * @route   GET /api/admin/courses
 * @desc    Get all available courses
 * @access  Admin only
 */
router.get(
  '/courses',
  authenticate,
  authorize('admin'),
  adminController.getAvailableCourses
);

/**
 * @route   GET /api/admin/courses/:courseCode
 * @desc    Get course details with patterns
 * @access  Admin only
 */
router.get(
  '/courses/:courseCode',
  authenticate,
  authorize('admin'),
  adminController.getCourseDetails
);

module.exports = router;