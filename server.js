require('dotenv').config(); // ✅ FIRST LINE

const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

// Load env vars
dotenv.config();

// Import routes
const authRoutes = require("./routes/authRoutes");
const onboardingRoutes = require("./routes/onboardingRoutes");
const resourceRoutes = require("./routes/resourceRoutes");
const quizRoutes = require("./routes/quizRoutes");
const adminRoutes = require('./routes/adminRoutes');
const studentRoutes = require('./routes/studentRoutes');

// Initialize app
const app = express();

app.set("trust proxy", 1);

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("✅ Uploads directory created");
}

// ======================
// 🔐 MIDDLEWARE
// ======================
const isDevelopment = process.env.NODE_ENV === "development";

const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      console.log("CORS origin:", origin);
      if (!origin && isDevelopment) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ======================
// 🗄️ DATABASE
// ======================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// ======================
// 📦 ROUTES
// ======================
app.use("/api/auth", authRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/quizzes", quizRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "BrainQuest API is running",
    version: "2.1.0",
    features: [
      "Supabase Authentication",
      "Google Sign-In (via Supabase)",
      "File Upload (PDF, Images, Documents)",
      "OCR Text Extraction",
      "AI-Powered Quiz Generation",
      "Quiz Attempts & Grading",
    ],
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uploadsDir: fs.existsSync(uploadsDir) ? "exists" : "missing",
  });
});

// ======================
// ❌ ERROR HANDLER
// ======================
app.use((err, req, res, next) => {
  console.error("Server error:", err);

  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ success: false, message: "File size too large. Maximum size is 10MB." });
    }
    return res.status(400).json({ success: false, message: err.message });
  }

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ success: false, message: "CORS policy does not allow this origin" });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// ======================
// 🚫 404 HANDLER
// ======================
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ======================
// 🛑 GRACEFUL SHUTDOWN
// ======================
process.on("SIGTERM", async () => {
  console.log("SIGTERM signal received: closing server");
  try {
    const ocrService = require("./utils/ocrService");
    await ocrService.terminateWorker();
  } catch (err) {
    console.log("OCR worker not running or failed to terminate");
  }
  process.exit(0);
});

// ======================
// 🚀 START SERVER
// ======================
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
  console.log(`🔐 Environment: ${process.env.NODE_ENV || "development"}`);
});