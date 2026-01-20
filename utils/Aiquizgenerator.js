const OpenAI = require('openai');

/**
 * AI Quiz Generator Service
 * Uses OpenAI API to generate educational quizzes from text
 */
class AIQuizGenerator {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Generate quiz questions from text
   * @param {string} text - Source text to generate quiz from
   * @param {Object} options - Generation options
   * @returns {Promise<Array>} - Array of quiz questions
   */
  async generateQuiz(text, options = {}) {
    const {
      numQuestions = 10,
      difficulty = 'mixed',
      questionTypes = ['multiple-choice', 'true-false', 'short-answer'],
      subject = '',
      focus = ''
    } = options;

    try {
      return await this.generateWithOpenAI(text, {
        numQuestions,
        difficulty,
        questionTypes,
        subject,
        focus
      });
    } catch (error) {
      console.error('Quiz generation error:', error);
      throw new Error(`Failed to generate quiz: ${error.message}`);
    }
  }

  /**
   * Generate quiz using OpenAI
   */
  async generateWithOpenAI(text, options) {
    const {
      numQuestions,
      difficulty,
      questionTypes,
      subject,
      focus
    } = options;

    const prompt = this.buildPrompt(text, {
      numQuestions,
      difficulty,
      questionTypes,
      subject,
      focus
    });

    console.log('Generating quiz with OpenAI...');

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert educational content creator who generates high-quality quiz questions.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    });

    const responseText = completion.choices[0].message.content;
    return this.parseQuizResponse(responseText);
  }

  /**
   * Build the prompt for AI quiz generation
   */
  buildPrompt(text, options) {
    const { numQuestions, difficulty, questionTypes, subject, focus } = options;

    const difficultyInstructions = this.getDifficultyInstructions(
      difficulty,
      numQuestions
    );
    const typeInstructions = this.getTypeInstructions(questionTypes);

    return `You are an expert educational content creator. Generate ${numQuestions} high-quality quiz questions based on the following text.

SOURCE TEXT:
${text.substring(0, 6000)} ${text.length > 6000 ? '...(truncated)' : ''}

${subject ? `SUBJECT: ${subject}` : ''}
${focus ? `FOCUS AREA: ${focus}` : ''}

REQUIREMENTS:
1. Create exactly ${numQuestions} questions
2. ${difficultyInstructions}
3. ${typeInstructions}
4. Each question must be clear, unambiguous, and based on the source text
5. For multiple-choice: provide 4 options (A, B, C, D) with exactly one correct answer
6. For true-false: create clear statements
7. For short-answer: questions should have concise, specific answers

FORMAT YOUR RESPONSE AS JSON:
{
  "questions": [
    {
      "type": "multiple-choice" | "true-false" | "short-answer",
      "question": "Question text here",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "The correct answer",
      "acceptableAnswers": ["answer1", "answer2"],
      "explanation": "Brief explanation of the correct answer",
      "difficulty": "easy" | "medium" | "hard",
      "points": 1
    }
  ]
}

IMPORTANT: Return ONLY the JSON, no additional text or markdown formatting.`;
  }

  getDifficultyInstructions(difficulty, numQuestions) {
    if (difficulty === 'mixed') {
      const easy = Math.ceil(numQuestions * 0.3);
      const medium = Math.ceil(numQuestions * 0.5);
      const hard = numQuestions - easy - medium;
      return `Distribute difficulty: ${easy} easy, ${medium} medium, ${hard} hard questions`;
    }
    return `All questions should be ${difficulty} difficulty`;
  }

  getTypeInstructions(types) {
    if (types.length === 1) {
      return `All questions should be ${types[0]} type`;
    }
    return `Use a mix of question types: ${types.join(', ')}`;
  }

  parseQuizResponse(responseText) {
    try {
      let cleanText = responseText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      const parsed = JSON.parse(cleanText);

      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error('Invalid response format: missing questions array');
      }

      return parsed.questions.map((q, index) =>
        this.validateAndNormalizeQuestion(q, index)
      );
    } catch (error) {
      console.error('Parse error:', error);
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }

  validateAndNormalizeQuestion(question, index) {
    const normalized = {
      type: question.type,
      question: question.question,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation || '',
      difficulty: question.difficulty || 'medium',
      points: question.points || 1
    };

    if (question.type === 'multiple-choice') {
      if (!question.options || question.options.length < 2) {
        throw new Error(`Question ${index + 1}: Multiple choice must have options`);
      }
      normalized.options = question.options;
    } else if (question.type === 'short-answer') {
      normalized.acceptableAnswers =
        question.acceptableAnswers || [question.correctAnswer];
    }

    if (!normalized.question) {
      throw new Error(`Question ${index + 1}: Missing question text`);
    }
    if (!normalized.correctAnswer) {
      throw new Error(`Question ${index + 1}: Missing correct answer`);
    }

    return normalized;
  }

  async generateQuizWithRetry(text, options, maxRetries = 2) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Quiz generation attempt ${attempt}/${maxRetries}`);
        const questions = await this.generateQuiz(text, options);
        if (questions.length > 0) return questions;
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    throw lastError || new Error('Failed to generate quiz after multiple attempts');
  }
}

module.exports = new AIQuizGenerator();
