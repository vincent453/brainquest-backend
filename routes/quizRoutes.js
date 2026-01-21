const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const { authenticate,  requireStudent } = require('../middleware/auth');

/**
 * @route   POST /api/quizzes/generate
 * @desc    Generate quiz from a resource using AI
 * @access  Admin only
 */
router.post(
  '/generate',
  authenticate,
  
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
 * @access  Student only
 */
router.get(
  '/my-attempts',
  authenticate,
  requireStudent,
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
  
  quizController.deleteQuiz
);

/**
 * @route   POST /api/quizzes/:id/attempt
 * @desc    Submit a quiz attempt
 * @access  Student only
 */
router.post(
  '/:id/attempt',
  authenticate,
  requireStudent,
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
  
  quizController.getQuizAttempts
);

module.exports = router;