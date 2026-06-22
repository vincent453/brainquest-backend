const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route   POST /api/quizzes/generate
 * @desc    Generate quiz from a resource using AI
 * @access  Admin only
 */
router.post(
  '/generate',
  authenticate,
  authorize('admin'),
  quizController.generateQuiz
);

/**
 * @route   GET /api/quizzes
 * @desc    Get all quizzes (filtered by role)
 * @access  Authenticated users
 */
router.get(
  '/',
  authenticate,
  quizController.getAllQuizzes
);

/**
 * @route   GET /api/quizzes/my-attempts
 * @desc    Get current student's quiz attempts
 * @access  Authenticated users
 * NOTE: Must be defined BEFORE /:id to avoid route conflict
 */
router.get(
  '/my-attempts',
  authenticate,
  quizController.getMyAttempts
);

/**
 * @route   GET /api/quizzes/:id
 * @desc    Get single quiz by ID
 * @access  Authenticated users
 */
router.get(
  '/:id',
  authenticate,
  quizController.getQuizById
);

/**
 * @route   PUT /api/quizzes/:id
 * @desc    Update quiz
 * @access  Admin only
 */
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  quizController.updateQuiz
);

/**
 * @route   PATCH /api/quizzes/:id/publish
 * @desc    Publish or unpublish a quiz
 * @access  Admin only
 */
router.patch(
  '/:id/publish',
  authenticate,
  authorize('admin'),
  quizController.togglePublish
);

/**
 * @route   DELETE /api/quizzes/:id
 * @desc    Delete quiz
 * @access  Admin only
 */
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  quizController.deleteQuiz
);

/**
 * @route   POST /api/quizzes/:id/attempt
 * @desc    Submit a quiz attempt
 * @access  Authenticated users (students)
 */
router.post(
  '/:id/attempt',
  authenticate,
  quizController.submitQuizAttempt
);

/**
 * @route   GET /api/quizzes/:id/attempts
 * @desc    Get all attempts for a quiz
 * @access  Admin only
 */
router.get(
  '/:id/attempts',
  authenticate,
  authorize('admin'),
  quizController.getQuizAttempts
);

module.exports = router;