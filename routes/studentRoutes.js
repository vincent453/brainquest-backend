
// ========================================
// STUDENT ROUTES (Quiz & Exam)
// ========================================
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const studentController = require('../controllers/Studentquizexamcontroller');

/**
 * @route   GET /api/student/quiz/past-questions
 * @desc    Get past question quiz by course code and year (WAY 1)
 * @access  Student
 */


// Configure multer for multiple files
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and images allowed'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});


router.get(
  '/quiz/past-questions',
  authenticate,
  studentController.getPastQuestionQuiz
);

/**
 * @route   POST /api/student/exam/generate
 * @desc    Upload materials and generate exam (WAY 2)
 * @access  Student
 */
router.post(
  '/exam/generate',
  authenticate,
  upload.array('files', 5), // Max 5 files
  studentController.generateExamFromMaterials
);

/**
 * @route   GET /api/student/exam/:examId/status
 * @desc    Check exam generation status
 * @access  Student
 */
router.get(
  '/exam/:examId/status',
  authenticate,
  studentController.checkExamStatus
);

/**
 * @route   GET /api/student/exams/my-exams
 * @desc    Get all my generated exams
 * @access  Student
 */
router.get(
  '/exams/my-exams',
  authenticate,
  studentController.getMyExams
);

module.exports = router;