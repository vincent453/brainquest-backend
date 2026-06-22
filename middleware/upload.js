const multer = require('multer');

// Use memory storage (required for Cloudinary buffer upload)
const storage = multer.memoryStorage();

// Allowed mime types
const allowedMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif'
];

const upload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10 // max number of files
  },

  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files are allowed'));
    }
  }
});

module.exports = upload;