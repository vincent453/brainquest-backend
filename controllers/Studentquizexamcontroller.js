const Course = require('../models/Course');
const Quiz = require('../models/Quiz');
const Exam = require('../models/Exam');
const Resource = require('../models/Resource');
const ocrService = require('../utils/ocrService');
const AIQuizGenerator = require('../utils/Aiquizgenerator');
/**
 * WAY 1: Student selects course code and year to take past question quiz
 */
exports.getPastQuestionQuiz = async (req, res) => {
  try {
    const { courseCode, year } = req.query;

    if (!courseCode) {
      return res.status(400).json({
        success: false,
        message: 'Course code is required'
      });
    }

    // Find course
    const course = await Course.findOne({ courseCode: courseCode.toUpperCase() });

    if (!course) {
      // Course doesn't exist at all
      return res.status(404).json({
        success: false,
        message: `Sorry, we don't have any past questions for ${courseCode.toUpperCase()} yet.`,
        suggestion: 'Try uploading your course materials to generate practice questions!'
      });
    }

    // Check if year is provided
    if (!year) {
      // Return available years
      return res.json({
        success: true,
        message: `${courseCode.toUpperCase()} is available!`,
        data: {
          courseCode: course.courseCode,
          courseName: course.courseName,
          availableYears: course.availableYears,
          totalQuizzes: course.totalQuizzes
        }
      });
    }

    // Check if quiz exists for that year
    if (!course.availableYears.includes(year)) {
      return res.status(404).json({
        success: false,
        message: `Sorry, ${courseCode.toUpperCase()} ${year} past questions are not available.`,
        data: {
          availableYears: course.availableYears
        },
        suggestion: `Available years for ${courseCode.toUpperCase()}: ${course.availableYears.join(', ')}`
      });
    }

    // Find the quiz
    const quiz = await Quiz.findOne({
      courseCode: courseCode.toUpperCase(),
      year: year,
      quizType: 'past-question',
      isPublished: true
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: `${courseCode.toUpperCase()} ${year} quiz is not published yet.`,
        suggestion: 'Please check back later or try another year.'
      });
    }

    // Remove correct answers for student
    const quizData = quiz.toObject();
    quizData.questions = quizData.questions.map(q => {
      const { correctAnswer, explanation, ...questionWithoutAnswer } = q;
      return questionWithoutAnswer;
    });

    res.json({
      success: true,
      message: `${courseCode.toUpperCase()} ${year} Past Questions`,
      data: {
        quiz: quizData,
        totalQuestions: quiz.questions.length,
        timeLimit: quiz.timeLimit,
        passingScore: quiz.passingScore
      }
    });

  } catch (error) {
    console.error('Error getting past question quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get quiz',
      error: error.message
    });
  }
};

/**
 * WAY 2: Student uploads their own materials to generate exam
 */
exports.generateExamFromMaterials = async (req, res) => {
  try {
    // Files uploaded by student
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please upload at least one course material file'
      });
    }

    const { courseCode, courseName, numQuestions = 15 } = req.body;

    if (!courseCode) {
      return res.status(400).json({
        success: false,
        message: 'Course code is required'
      });
    }

    // Save uploaded resources
    const studentResources = [];
    for (const file of req.files) {
      const resource = new Resource({
        title: `${req.user.firstName}'s ${courseCode} Material`,
        description: `Study material uploaded by student`,
        originalFileName: file.originalname,
        fileType: file.mimetype === 'application/pdf' ? 'pdf' : 'image',
        mimeType: file.mimetype,
        fileSize: file.size,
        filePath: file.path,
        uploadedBy: req.user._id,
        category: courseCode,
        subject: courseCode
      });

      await resource.save();
      studentResources.push({
        resourceId: resource._id,
        fileName: file.originalname,
        uploadedAt: new Date()
      });

      // Process asynchronously
      processStudentResourceAsync(resource._id);
    }

    // Create exam record (will be populated later)
    const exam = new Exam({
      title: `${courseCode} Practice Exam`,
      description: `AI-generated exam based on your materials`,
      courseCode: courseCode.toUpperCase(),
      courseName: courseName || courseCode,
      studentResources,
      studentId: req.user._id,
      subject: courseCode,
      status: 'generating',
      generationStrategy: 'content-based' // Will update if patterns found
    });

    await exam.save();

    // Start exam generation in background
    generateExamAsync(exam._id, courseCode, studentResources, numQuestions);

    res.status(202).json({
      success: true,
      message: 'Your materials are being processed. Exam will be ready shortly!',
      data: {
        examId: exam._id,
        courseCode,
        filesUploaded: studentResources.length,
        estimatedTime: '30-60 seconds'
      }
    });

  } catch (error) {
    console.error('Error generating exam:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate exam',
      error: error.message
    });
  }
};

/**
 * Process student's uploaded resource (OCR)
 */
async function processStudentResourceAsync(resourceId) {
  try {
    const resource = await Resource.findById(resourceId);
    if (!resource) return;

    const extractedText = await ocrService.extractText(resource.filePath, resource.mimeType);
    
    resource.extractedText = extractedText;
    resource.ocrProcessed = true;
    resource.ocrProcessedAt = new Date();
    resource.status = 'completed';
    await resource.save();

  } catch (error) {
    console.error('Error processing student resource:', error);
  }
}

/**
 * Generate exam asynchronously with pattern matching
 */
async function generateExamAsync(examId, courseCode, studentResources, numQuestions) {
  try {
    const exam = await Exam.findById(examId);
    if (!exam) return;

    // Step 1: Get all extracted text from student's materials
    const resources = await Resource.find({
      _id: { $in: studentResources.map(r => r.resourceId) }
    });

    // Wait a bit for OCR to complete
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Reload resources to get extracted text
    const processedResources = await Resource.find({
      _id: { $in: studentResources.map(r => r.resourceId) }
    });

    const combinedText = processedResources
      .map(r => r.extractedText || '')
      .filter(t => t.length > 0)
      .join('\n\n');

    if (!combinedText || combinedText.length < 100) {
      throw new Error('Could not extract sufficient text from uploaded materials');
    }

    // Step 2: Check if we have past questions for this course
    const course = await Course.findOne({ courseCode: courseCode.toUpperCase() });
    const hasPastQuestions = course && course.totalQuizzes > 0;

    let questions = [];
    let aiMessage = '';
    let generationStrategy = 'content-based';

    if (hasPastQuestions) {
      // PATTERN-BASED GENERATION
      console.log(`Found past questions for ${courseCode}. Using pattern matching...`);
      
      const confidence = course.getPatternConfidence();
      
      exam.patternMatching = {
        hasPastQuestions: true,
        matchedCourseCode: course.courseCode,
        confidence: confidence,
        yearsAnalyzed: course.availableYears,
        patternsUsed: {
          topicDistribution: true,
          questionTypes: true,
          difficultyLevel: true
        }
      };

      // Generate questions based on patterns
      questions = await generateWithPatterns(combinedText, course, numQuestions);
      generationStrategy = 'pattern-based';

      // Smart message based on confidence
      if (confidence >= 90) {
        aiMessage = `✅ Excellent! We found ${course.totalQuizzes} past questions for ${courseCode} (${course.availableYears.join(', ')}). Generated ${numQuestions} questions based on exam patterns with ${confidence}% confidence.`;
      } else if (confidence >= 60) {
        aiMessage = `⚠️ We have limited data for ${courseCode} (${course.totalQuizzes} past papers). Generated ${numQuestions} questions combining past patterns (${confidence}% confidence) with your materials.`;
      } else {
        aiMessage = `ℹ️ We have very limited ${courseCode} past questions. Generated ${numQuestions} questions mostly from your materials with some pattern influence.`;
      }

    } else {
      // CONTENT-BASED GENERATION (No past questions available)
      console.log(`No past questions for ${courseCode}. Using content-only...`);
      
      exam.patternMatching = {
        hasPastQuestions: false,
        matchedCourseCode: null,
        confidence: 0,
        yearsAnalyzed: [],
        patternsUsed: {
          topicDistribution: false,
          questionTypes: false,
          difficultyLevel: false
        }
      };

      // Generate from content only
      const aiGenerator = new AIQuizGenerator();
      questions = await aiGenerator.generateQuizWithRetry(combinedText, {
        numQuestions,
        difficulty: 'mixed',
        questionTypes: ['multiple-choice', 'true-false', 'short-answer']
      });

      questions = questions.map(q => ({
        ...q,
        basedOnPattern: false,
        likelihood: 'medium'
      }));

      aiMessage = `ℹ️ No past questions found for ${courseCode}. Generated ${numQuestions} practice questions based on your uploaded materials. These questions cover the topics in your notes.`;
    }

    // Update exam
    exam.questions = questions;
    exam.status = 'ready';
    exam.generationStrategy = generationStrategy;
    exam.aiMessage = aiMessage;
    await exam.save();

    console.log(`Exam generated successfully for ${courseCode}`);

  } catch (error) {
    console.error('Error generating exam:', error);
    
    const exam = await Exam.findById(examId);
    if (exam) {
      exam.status = 'failed';
      exam.aiMessage = `Failed to generate exam: ${error.message}`;
      await exam.save();
    }
  }
}

/**
 * Generate questions based on past exam patterns
 */
async function generateWithPatterns(studentText, course, numQuestions) {
  const aiGenerator = new AIQuizGenerator();
  
  // Build pattern-aware prompt
  const patternInfo = `
COURSE: ${course.courseCode} - ${course.courseName}
PAST EXAM PATTERNS ANALYZED (${course.availableYears.join(', ')}):

COMMON TOPICS (Focus on these):
${course.commonTopics.slice(0, 5).map(t => `- ${t.topic} (appears ${t.frequency}% of the time, ${t.importance} importance)`).join('\n')}

QUESTION TYPE DISTRIBUTION:
- Multiple Choice: ${course.questionPatterns.multipleChoice}%
- True/False: ${course.questionPatterns.trueFalse}%
- Short Answer: ${course.questionPatterns.shortAnswer}%

DIFFICULTY DISTRIBUTION:
- Easy: ${course.difficultyDistribution.easy}%
- Medium: ${course.difficultyDistribution.medium}%
- Hard: ${course.difficultyDistribution.hard}%

STUDENT'S STUDY MATERIAL:
${studentText}

TASK:
Generate ${numQuestions} exam questions that:
1. Follow the question type distribution above
2. Follow the difficulty distribution above
3. Focus heavily on the common topics listed
4. Cover content from the student's materials
5. Mimic real exam style for ${course.courseCode}
`;

  const prompt = `${patternInfo}

For each question, mark if it's based on a common topic (likelihood: high/medium/low).

OUTPUT FORMAT (JSON):
[
  {
    "type": "multiple-choice",
    "question": "Question text",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": "B",
    "explanation": "Explanation",
    "difficulty": "medium",
    "topic": "Topic name",
    "likelihood": "high",
    "basedOnPattern": true,
    "points": 1
  }
]

Return ONLY valid JSON, no markdown.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    let content = data.content[0].text.trim();
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    const questions = JSON.parse(content);
    return questions;

  } catch (error) {
    console.error('Error generating with patterns:', error);
    throw error;
  }
}

/**
 * Check exam generation status
 */
exports.checkExamStatus = async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findById(examId);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    // Verify ownership
    if (exam.studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (exam.status === 'ready') {
      // Remove correct answers
      const examData = exam.toObject();
      examData.questions = examData.questions.map(q => {
        const { correctAnswer, explanation, ...questionWithoutAnswer } = q;
        return questionWithoutAnswer;
      });

      return res.json({
        success: true,
        status: 'ready',
        message: exam.aiMessage,
        data: {
          exam: examData,
          patternInfo: exam.patternMatching,
          totalQuestions: exam.questions.length,
          questionsByLikelihood: {
            high: exam.questions.filter(q => q.likelihood === 'high').length,
            medium: exam.questions.filter(q => q.likelihood === 'medium').length,
            low: exam.questions.filter(q => q.likelihood === 'low').length
          }
        }
      });
    }

    res.json({
      success: true,
      status: exam.status,
      message: exam.status === 'generating' ? 'Processing your materials...' : exam.aiMessage
    });

  } catch (error) {
    console.error('Error checking exam status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check status',
      error: error.message
    });
  }
};

/**
 * Get all student's exams
 */
exports.getMyExams = async (req, res) => {
  try {
    const exams = await Exam.find({
      studentId: req.user._id
    })
      .select('-questions.correctAnswer -questions.explanation')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        exams,
        totalExams: exams.length
      }
    });
  } catch (error) {
    console.error('Error fetching exams:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exams',
      error: error.message
    });
  }
};

