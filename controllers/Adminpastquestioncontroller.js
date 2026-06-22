const Resource = require('../models/Resource');
const Quiz = require('../models/Quiz');
const Course = require('../models/Course');
const ocrService = require('../utils/ocrService');
const streamifier = require('streamifier');
const cloudinary = require('../utils/cloudinary');

/**
 * =========================
 * CLOUDINARY UPLOAD HELPER
 * =========================
 */
function uploadToCloudinary(fileBuffer, resourceType = 'raw') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType, folder: 'resources' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
}

/**
 * =========================
 * BULK UPLOAD PAST QUESTIONS
 * POST /api/admin/past-questions/bulk-upload
 * =========================
 */
exports.bulkUploadPastQuestions = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const { courseCode, courseName, department, level } = req.body;

    if (!courseCode) {
      return res.status(400).json({ success: false, message: 'courseCode is required' });
    }

    // Find or create course
    let course = await Course.findOne({ courseCode: courseCode.toUpperCase() });
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
          title: `${courseCode.toUpperCase()} - ${year} Past Questions`,
          description: `Past question paper for ${courseCode.toUpperCase()} (${year})`,
          originalFileName: file.originalname,
          fileType: 'pdf',
          filename: uploadedFile.public_id,
          filePath: uploadedFile.secure_url,
          fileSize: file.size,
          mimetype: file.mimetype || 'application/pdf',
          uploadedBy: req.user._id,
          subject: courseCode.toUpperCase(),
          tags: [courseCode.toUpperCase(), year, 'past-questions']
        });

        uploadedResources.push({ resourceId: resource._id, year });

        processingJobs.push(
          processPastQuestionAsync(resource._id, course._id, courseCode.toUpperCase(), year)
        );
      } catch (err) {
        console.error(`File upload failed: ${file.originalname}`, err.message);
      }
    }

    if (uploadedResources.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'All file uploads failed. Check server logs for details.'
      });
    }

    res.status(201).json({
      success: true,
      message: `${uploadedResources.length} of ${req.files.length} files uploaded successfully`,
      data: { courseCode: courseCode.toUpperCase(), uploadedFiles: uploadedResources }
    });

    // Run background processing after response is sent
    Promise.all(processingJobs).catch(err =>
      console.error('Background processing error:', err)
    );

  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * =========================
 * ASYNC PROCESSING FUNCTION
 * OCR → AI extraction → Quiz creation → Course update
 * =========================
 */
async function processPastQuestionAsync(resourceId, courseId, courseCode, year) {
  let resource;

  try {
    resource = await Resource.findById(resourceId);
    if (!resource) return;

    // Step 1: OCR
    resource.ocrStatus = 'processing';
    await resource.save();

    const extractedText = await ocrService.extractText(resource.filePath, resource.mimetype);

    resource.extractedText = extractedText;
    resource.ocrStatus = 'completed';
    resource.isProcessed = true;
    await resource.save();

    console.log(`✅ OCR completed for ${courseCode}-${year}`);

    // Step 2: AI question extraction
    console.log(`🤖 Extracting questions from ${courseCode}-${year}...`);
    const questions = await extractPastQuestions(extractedText);

    if (!questions || questions.length === 0) {
      throw new Error('AI returned no questions from the extracted text');
    }

    // Step 3: Create Quiz
    const quiz = await Quiz.create({
      title: `${courseCode} ${year} Past Questions`,
      description: `Past question paper for ${courseCode} (${year})`,
      courseCode,
      year,
      quizType: 'past-question',
      questions,
      sourceResource: resourceId,
      createdBy: resource.uploadedBy,
      subject: courseCode,
      tags: [courseCode, year, 'past-questions'],
      isPublished: false // Admin must publish manually after review
    });

    // Link quiz back to resource
    resource.quizGenerated = true;
    resource.generatedQuizzes.push(quiz._id);
    await resource.save();

    // Step 4: Update Course with year, quiz reference, and pattern data
    const course = await Course.findById(courseId);
    if (course) {
      // Add year if not already listed
      if (!course.availableYears.includes(year)) {
        course.availableYears.push(year);
      }

      // Add past question entry
      course.pastQuestions.push({
        year,
        quizId: quiz._id,
        questionCount: questions.length,
        uploadedAt: new Date(),
        uploadedBy: resource.uploadedBy
      });

      course.totalQuizzes = course.pastQuestions.length;

      // Update topic and difficulty patterns from this quiz
      analyzeAndUpdatePatterns(course, quiz);

      await course.save();
    }

    console.log(`✅ Processing complete for ${courseCode}-${year}: ${questions.length} questions extracted`);

  } catch (error) {
    console.error(`❌ Processing error for resource ${resourceId}:`, error.message);

    if (resource) {
      resource.ocrStatus = resource.ocrStatus === 'processing' ? 'failed' : resource.ocrStatus;
      resource.ocrError = error.message;
      await resource.save();
    }
  }
}

/**
 * =========================
 * AI QUESTION EXTRACTION
 * Uses Anthropic Claude to pull structured questions from OCR text
 * =========================
 */
async function extractPastQuestions(text) {
  const prompt = `You are an expert at extracting exam questions from scanned academic papers.

Extract ALL questions from the text below. For each question determine:
- The question type (multiple-choice, true-false, or short-answer)
- The question text
- Options (for multiple-choice)
- The correct answer (infer from context or mark as "See marking scheme" if unclear)
- Difficulty (easy/medium/hard based on complexity)
- Topic (the subject area the question covers)

TEXT TO EXTRACT FROM:
${text.substring(0, 12000)}

Return ONLY a valid JSON array, no markdown, no explanation:
[
  {
    "type": "multiple-choice",
    "question": "Question text here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A",
    "explanation": "",
    "difficulty": "medium",
    "topic": "Topic name",
    "points": 1
  }
]`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.content[0].text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  return JSON.parse(content);
}

/**
 * =========================
 * COURSE PATTERN ANALYSIS
 * Updates topic and difficulty distribution on the course document
 * =========================
 */
function analyzeAndUpdatePatterns(course, quiz) {
  const questions = quiz.questions;
  const total = questions.length;
  if (total === 0) return;

  // Question type distribution
  const mcq = questions.filter(q => q.type === 'multiple-choice').length;
  const tf  = questions.filter(q => q.type === 'true-false').length;
  const sa  = questions.filter(q => q.type === 'short-answer').length;

  course.questionPatterns = {
    multipleChoice: Math.round((mcq / total) * 100),
    trueFalse:      Math.round((tf  / total) * 100),
    shortAnswer:    Math.round((sa  / total) * 100)
  };

  // Difficulty distribution
  const easy   = questions.filter(q => q.difficulty === 'easy').length;
  const medium = questions.filter(q => q.difficulty === 'medium').length;
  const hard   = questions.filter(q => q.difficulty === 'hard').length;

  course.difficultyDistribution = {
    easy:   Math.round((easy   / total) * 100),
    medium: Math.round((medium / total) * 100),
    hard:   Math.round((hard   / total) * 100)
  };

  // Topic frequency — merge with existing commonTopics
  const topicMap = {};

  // Seed from existing topics
  for (const t of course.commonTopics) {
    topicMap[t.topic] = t.frequency || 0;
  }

  // Count topics from this quiz
  for (const q of questions) {
    if (q.topic) {
      topicMap[q.topic] = (topicMap[q.topic] || 0) + 1;
    }
  }

  // Convert to sorted array with importance labels
  course.commonTopics = Object.entries(topicMap)
    .map(([topic, count]) => ({
      topic,
      frequency: Math.round((count / total) * 100),
      importance: count >= total * 0.3 ? 'high' : count >= total * 0.1 ? 'medium' : 'low'
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 20); // Keep top 20 topics
}

/**
 * =========================
 * GET ALL COURSES
 * GET /api/admin/courses
 * =========================
 */
exports.getAvailableCourses = async (req, res) => {
  try {
    const { department, level, search } = req.query;
    const query = { isActive: true };

    if (department) query.department = department;
    if (level) query.level = level;
    if (search) query.courseCode = { $regex: search.toUpperCase(), $options: 'i' };

    const courses = await Course.find(query).sort({ courseCode: 1 });
    res.json({ success: true, total: courses.length, data: courses });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * =========================
 * GET COURSE DETAILS
 * GET /api/admin/courses/:courseCode
 * =========================
 */
exports.getCourseDetails = async (req, res) => {
  try {
    const course = await Course.findOne({
      courseCode: req.params.courseCode.toUpperCase()
    }).populate('pastQuestions.quizId', 'title totalAttempts averageScore isPublished createdAt');

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    res.json({ success: true, data: course });
  } catch (error) {
    console.error('Get course details error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};