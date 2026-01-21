const Quiz = require('../models/Quiz');
const Resource = require('../models/Resource');
const QuizAttempt = require('../models/QuizAttempt');
const aiQuizGenerator = require('../utils/Aiquizgenerator');

/**
 * Generate quiz from a resource 
 * POST /api/quiz/generate
 * Admin only
 */

exports.generateQuiz = async (req, res) => {
    try {
        const {
            resourceId,
            title,
            description,
            numQuestions = 10,
            difficulty = 'mixed',
            questionTypes = ['multiple-choice', 'true-false', 'short-answer'],
            timeLimit,
            passingScore = 70,
            subject,
            tags,
            focus
        } = req.body;

        // validate resource
        const resource = await Resource.findById(resourceId);

        if (!resource || resource.isDeleted) {
            return res.status(404).json({
                success: false,
                message: 'Resource not found'
            });
        }

        if (resource.ocrStatus !== 'completed' || !resource.extractedText) {
            return res.status(400).json({
                success: false,
                message: 'Resource has not been processed yet or OCR failed'
            });
        }

        // Check if text is sufficient
        if (resource.extractedText.length < 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Extracted text is too short to generate meaningful quiz'
            })
        }

        // Generate quiz using AI
        console.log('Generating Quiz from resource ${resourceId}....1');

        const questions = await aiQuizGenerator.generateQuizWithRetry(
            resource.extractedText,
            {
              numQuestions,
              difficulty,
              questionTypes,
              subject: subject || resource.subject,
              focus
            }
        );

        if (!questions || questions.length === 0) {
            return res.status(500).json({
                success: false,
                message: 'Failed to generate quiz questions'
            });
        }

        // Create Quiz 
        const quiz = new Quiz({
            title: title || `Quiz: ${resource.title}`,
            description: description || `Auto-generated quiz from ${resource.title}`,
            sourceResource: resourceId,
            sourceText: resource.extractedText.substring(0, 500) + '...',
            questions,
            timeLimit,
            passingScore,
            generatedBy: process.env.OPENAI_API_KEY ? 'openai' : 'anthropic',
            createdBy: req.user._id,
            subject: subject || resource.subject,
            tags: tags || resource.tags
        });

        await quiz.save();

        // Update resource
        resource.quizGenerated = true;
        resource.generatedQuizzes.push(quiz._id);
        await resource.save();

        res.status(201).json({
            success: true,
            message: 'Quiz generated successfully',
            data: { quiz }
        });
    } catch (error) {
        console.error('Error generating quiz:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generating quiz',
            error: error.message
        });
    }
};

/**
 * Get all quizzes
 * GET /api/quizzes
 */

exports.getAllQuizzes = async (req, res) => {
    try {
        const { page = 1, limit = 10, isPublished, subject } = req.query;

        //Build query
        const query = {};

        // Students can only see published quizzes
        if (req.user.role === 'student') {
            query.isPublished = true;
        } else if (isPublished !== undefined) {
            query.isPublished = isPublished === 'true';
    }
        if (subject) query.subject = subject;

        const quizzes = await Quiz.find(query)
        .populate('sourceResource', 'title fileType')
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .select('-questions'); // Exclude questions for listing

        const count = await Quiz.countDocuments(query); 

        res.json({
            success: true,
            data:{
                quizzes,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                total: count
            }
        });
    } catch (error) {
        console.error('Error fetching quizzes:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch quizzes',
            error: error.message
        });
    }   
};


/**
 * Get single quiz by ID
 * GET /api/quizzes/:id
 */
exports.getQuizById = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate('sourceResource', 'title fileType extractedText')
      .populate('createdBy', 'firstName lastName');
    
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }
    
    // Check access
    if (quiz.isPublished === false && req.user.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'This quiz is not yet published'
      });
    }
    
    // For students taking the quiz, hide correct answers
    let quizData = quiz.toObject();
    if (req.user.role === 'student' && req.query.forAttempt === 'true') {
      quizData.questions = quizData.questions.map(q => {
        const { correctAnswer, acceptableAnswers, explanation, ...questionData } = q;
        return questionData;
      });
    }
    
    res.json({
      success: true,
      data: { quiz: quizData }
    });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quiz',
      error: error.message
    });
  }
}; 

/**
 * Update quiz
 * PUT /api/quizzes/:id
 * Admin only
 */
exports.updateQuiz = async (req, res) => {
  try {
    const {
      title,
      description,
      questions,
      timeLimit,
      passingScore,
      subject,
      tags
    } = req.body;
    
    const quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }
    
    // Update fields
    if (title) quiz.title = title;
    if (description !== undefined) quiz.description = description;
    if (questions) quiz.questions = questions;
    if (timeLimit !== undefined) quiz.timeLimit = timeLimit;
    if (passingScore) quiz.passingScore = passingScore;
    if (subject) quiz.subject = subject;
    if (tags) quiz.tags = tags;
    
    await quiz.save();
    
    res.json({
      success: true,
      message: 'Quiz updated successfully',
      data: { quiz }
    });
  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quiz',
      error: error.message
    });
  }
};

/**
 * Publish/unpublish quiz
 * PATCH /api/quizzes/:id/publish
 * Admin only
 */
exports.togglePublish = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }
    
    quiz.isPublished = !quiz.isPublished;
    quiz.publishedAt = quiz.isPublished ? new Date() : null;
    
    await quiz.save();
    
    res.json({
      success: true,
      message: `Quiz ${quiz.isPublished ? 'published' : 'unpublished'} successfully`,
      data: { quiz }
    });
  } catch (error) {
    console.error('Toggle publish error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quiz status',
      error: error.message
    });
  }
};

/**
 * Delete quiz
 * DELETE /api/quizzes/:id
 * Admin only
 */
exports.deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }
    
    // Remove from resource's generated quizzes
    await Resource.findByIdAndUpdate(
      quiz.sourceResource,
      { $pull: { generatedQuizzes: quiz._id } }
    );
    
    await Quiz.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Quiz deleted successfully'
    });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete quiz',
      error: error.message
    });
  }
};

/**
 * Submit quiz attempt
 * POST /api/quizzes/:id/attempt
 * Student only
 */
exports.submitQuizAttempt = async (req, res) => {
  try {
    const { answers, startedAt } = req.body;
    
    const quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }
    
    if (!quiz.isPublished) {
      return res.status(403).json({
        success: false,
        message: 'This quiz is not available'
      });
    }
    
    // Validate answers format
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid answers format'
      });
    }
    
    // Grade the quiz
    const gradedAnswers = [];
    let totalScore = 0;
    
    for (const answer of answers) {
      const question = quiz.questions.id(answer.questionId);
      
      if (!question) {
        continue;
      }
      
      const isCorrect = checkAnswer(question, answer.studentAnswer);
      const pointsAwarded = isCorrect ? question.points : 0;
      
      totalScore += pointsAwarded;
      
      gradedAnswers.push({
        questionId: question._id,
        question: question.question,
        studentAnswer: answer.studentAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        pointsAwarded
      });
    }
    
    const completedAt = new Date();
    const timeTaken = Math.round((completedAt - new Date(startedAt)) / 1000);
    const percentage = Math.round((totalScore / quiz.totalPoints) * 100);
    const passed = percentage >= quiz.passingScore;
    
    // Create quiz attempt
    const attempt = new QuizAttempt({
      quiz: quiz._id,
      student: req.user._id,
      answers: gradedAnswers,
      score: totalScore,
      totalPoints: quiz.totalPoints,
      percentage,
      passed,
      startedAt,
      completedAt,
      timeTaken
    });
    
    await attempt.save();
    
    // Update quiz statistics
    quiz.totalAttempts += 1;
    quiz.averageScore = await calculateAverageScore(quiz._id);
    await quiz.save();
    
    res.status(201).json({
      success: true,
      message: 'Quiz submitted successfully',
      data: { attempt }
    });
  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit quiz',
      error: error.message
    });
  }
};

/**
 * Get student's quiz attempts
 * GET /api/quizzes/my-attempts
 * Student only
 */
exports.getMyAttempts = async (req, res) => {
  try {
    const { page = 1, limit = 20, quizId } = req.query;
    
    const query = { student: req.user._id };
    if (quizId) query.quiz = quizId;
    
    const attempts = await QuizAttempt.find(query)
      .populate('quiz', 'title totalQuestions totalPoints')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const count = await QuizAttempt.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        attempts,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count
      }
    });
  } catch (error) {
    console.error('Get attempts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attempts',
      error: error.message
    });
  }
};

/**
 * Get all attempts for a quiz (admin view)
 * GET /api/quizzes/:id/attempts
 * Admin only
 */
exports.getQuizAttempts = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const attempts = await QuizAttempt.find({ quiz: req.params.id })
      .populate('student', 'firstName lastName email username')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const count = await QuizAttempt.countDocuments({ quiz: req.params.id });
    
    res.json({
      success: true,
      data: {
        attempts,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count
      }
    });
  } catch (error) {
    console.error('Get quiz attempts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attempts',
      error: error.message
    });
  }
};

// Helper functions

function checkAnswer(question, studentAnswer) {
  const normalize = (str) => str.toLowerCase().trim();
  
  if (question.type === 'multiple-choice' || question.type === 'true-false') {
    return normalize(studentAnswer) === normalize(question.correctAnswer);
  }
  
  if (question.type === 'short-answer') {
    const normalizedAnswer = normalize(studentAnswer);
    const correctAnswers = [
      question.correctAnswer,
      ...(question.acceptableAnswers || [])
    ].map(normalize);
    
    return correctAnswers.some(correct => 
      normalizedAnswer.includes(correct) || correct.includes(normalizedAnswer)
    );
  }
  
  return false;
}

async function calculateAverageScore(quizId) {
  const attempts = await QuizAttempt.find({ quiz: quizId });
  
  if (attempts.length === 0) return 0;
  
  const totalPercentage = attempts.reduce((sum, attempt) => sum + attempt.percentage, 0);
  return Math.round(totalPercentage / attempts.length);
}

module.exports = exports;
