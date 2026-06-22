const Resource = require('../models/Resource');
const Quiz = require('../models/Quiz');
const Course = require('../models/Course');
const ocrService = require('../utils/ocrService');
const AIQuizGenerator = require('../utils/Aiquizgenerator');
const streamifier = require('streamifier');
const cloudinary = require('../utils/cloudinary');


/**
 * =========================
 * CLOUDINARY UPLOAD HELPER
 * =========================
 */
/**
 * CLOUDINARY UPLOAD
 */
function uploadToCloudinary(fileBuffer, resourceType = 'raw') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        folder: 'resources'
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
}

/**
 * BULK UPLOAD PAST QUESTIONS (SAFE VERSION)
 */
exports.bulkUploadPastQuestions = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const { courseCode, courseName, department, level } = req.body;

    let course = await Course.findOne({
      courseCode: courseCode.toUpperCase()
    });

    if (!course) {
      course = await Course.create({
        courseCode: courseCode.toUpperCase(),
        courseName: courseName || courseCode,
        department: department || 'General',
        level: level || '100'
      });
    }

    const uploadedResources = [];
    const processingJobs = [];

    for (const file of req.files) {
      try {
        const yearMatch = file.originalname.match(/(\d{4})/);
        const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

        // Upload to Cloudinary
        const uploadedFile = await uploadToCloudinary(file.buffer, 'raw');

        const resource = await Resource.create({
          title: `${courseCode} - ${year} Past Questions`,
          description: `Past question paper for ${courseCode} (${year})`,
          originalFileName: file.originalname,
          fileType: 'pdf',
          filename: uploadedFile.public_id,
          filePath: uploadedFile.secure_url,
          fileSize: file.size,
          mimetype: file.mimetype || 'application/pdf',
          uploadedBy: req.user._id,
          subject: courseCode,
          tags: [courseCode, year, 'past-questions']
        });

        uploadedResources.push({
          resourceId: resource._id,
          year
        });

        processingJobs.push(
          processPastQuestionAsync(resource._id, course._id, courseCode, year)
        );

      } catch (err) {
        console.error('File upload failed:', file.originalname, err);
      }
    }

    res.status(201).json({
      success: true,
      message: `${uploadedResources.length} files uploaded successfully`,
      data: {
        courseCode,
        uploadedFiles: uploadedResources
      }
    });

    Promise.all(processingJobs).catch(err =>
      console.error('Background processing error:', err)
    );

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * =========================
 * ASYNC PROCESSING FUNCTION
 * =========================
 */
async function processPastQuestionAsync(resourceId, courseId, courseCode, year) {
  let resource;

  try {
    resource = await Resource.findById(resourceId);
    if (!resource) return;

    resource.status = 'processing';
    await resource.save();

    // =========================
    // ONLY OCR (NO AI HERE)
    // =========================
    const extractedText = await ocrService.extractText(
      resource.filePath,
      resource.mimetype
    );

    resource.extractedText = extractedText;
    resource.ocrStatus = 'completed';
    resource.status = 'ready-for-quiz'; // important change
    await resource.save();

    console.log(`OCR completed for ${courseCode}-${year}`);

    // =========================
    // STOP HERE (NO AI)
    // =========================

  } catch (error) {
    console.error('Processing error:', error);

    if (resource) {
      resource.status = 'error';
      resource.ocrStatus = 'failed';
      resource.ocrError = error.message;
      await resource.save();
    }
  }
}


/**
 * =========================
 * AI QUESTION EXTRACTION
 * =========================
 */
async function extractPastQuestions(text) {
  const prompt = `
Extract all exam questions exactly as written.

TEXT:
${text}

Return ONLY JSON:
[
  {
    "type": "multiple-choice",
    "question": "",
    "options": [],
    "correctAnswer": "",
    "difficulty": "medium",
    "topic": "",
    "points": 1
  }
]
`;

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

  let content = data.content[0].text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  return JSON.parse(content);
}


/**
 * =========================
 * COURSE PATTERN ANALYSIS
 * =========================
 */
async function analyzeAndUpdatePatterns(course, quiz) {
  const questions = quiz.questions;

  const total = questions.length;

  const mcq = questions.filter(q => q.type === 'multiple-choice').length;
  const tf = questions.filter(q => q.type === 'true-false').length;
  const sa = questions.filter(q => q.type === 'short-answer').length;

  course.questionPatterns = {
    multipleChoice: Math.round((mcq / total) * 100),
    trueFalse: Math.round((tf / total) * 100),
    shortAnswer: Math.round((sa / total) * 100)
  };

  const easy = questions.filter(q => q.difficulty === 'easy').length;
  const medium = questions.filter(q => q.difficulty === 'medium').length;
  const hard = questions.filter(q => q.difficulty === 'hard').length;

  course.difficultyDistribution = {
    easy: Math.round((easy / total) * 100),
    medium: Math.round((medium / total) * 100),
    hard: Math.round((hard / total) * 100)
  };
}


/**
 * =========================
 * GET COURSES
 * =========================
 */
exports.getAvailableCourses = async (req, res) => {
  const courses = await Course.find({ isActive: true });
  res.json({ success: true, data: courses });
};


/**
 * =========================
 * GET COURSE DETAILS
 * =========================
 */
exports.getCourseDetails = async (req, res) => {
  const course = await Course.findOne({
    courseCode: req.params.courseCode.toUpperCase()
  }).populate('pastQuestions.quizId');

  if (!course) {
    return res.status(404).json({
      success: false,
      message: 'Course not found'
    });
  }

  res.json({ success: true, data: course });
};