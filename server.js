  const express = require('express');
  const mongoose = require('mongoose');
  const cors = require('cors');
  const passport = require('passport');
  const cookieParser = require('cookie-parser');
  const dotenv = require('dotenv');
  const fs = require('fs');
  const path = require('path');

  // Load env vars
  dotenv.config();

  // Import routes
  const authRoutes = require('./routes/authRoutes');
  const onboardingRoutes = require('./routes/onboardingRoutes');
  const resourceRoutes = require('./routes/resourceRoutes');
  const quizRoutes = require('./routes/quizRoutes');

  // Initialize app
  const app = express();

  // Trust proxy (important for Render)
  app.set('trust proxy', 1);

  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('✅ Uploads directory created');
  }

  // Passport config (Google strategy)
  require('./config/passport')(passport);

  // Middleware
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // ✅ Passport initialization ONLY (NO SESSION)
  app.use(passport.initialize());

  // Connect to MongoDB
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB connected successfully'))
    .catch((err) => {
      console.error('❌ MongoDB connection error:', err);
      process.exit(1);
    });

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/onboarding', onboardingRoutes);
  app.use('/api/resources', resourceRoutes);
  app.use('/api/quizzes', quizRoutes);

  // Root route
  app.get('/', (req, res) => {
    res.json({
      success: true,
      message: 'BrainQuest API is running',
      version: '2.0.0',
      features: [
        'User Authentication',
        'Google OAuth',
        'File Upload (PDF, Images, Documents)',
        'OCR Text Extraction',
        'AI-Powered Quiz Generation',
        'Quiz Attempts & Grading'
      ]
    });
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Server is running',
      timestamp: new Date().toISOString(),
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      uploadsDir: fs.existsSync(uploadsDir) ? 'exists' : 'missing'
    });
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error('Server error:', err);
    
    // Handle multer errors
    if (err.name === 'MulterError') {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum size is 10MB.'
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Internal server error',
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
    });
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');
    
    // Terminate OCR worker if running
    const ocrService = require('./utils/ocrService');
    await ocrService.terminateWorker();
    
    process.exit(0);
  });

  // Start server
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Uploads directory: ${uploadsDir}`);
    console.log(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
  });