const multer = require('multer');

const storage = multer.memoryStorage(); // keep file in memory
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpg',
      'image/jpeg',
      'image/webp',
      'image/gif'
    ];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type.'));
  }
});

module.exports = upload;
