const express = require('express');
const router = express.Router();
const resourceController = require('../controllers/resourceController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

/**
 * @route   POST /api/resources/upload
 * @desc    Upload a new resource
 * @access  Admin only
 */
router.post(
  '/upload',
  authenticate,
  authorize('admin'),
  upload.single('file'),
  resourceController.uploadResource
);

/**
 * @route   GET /api/resources
 * @desc    Get all resources with filters
 * @access  Authenticated users
 */
router.get(
  '/',
  authenticate,
  resourceController.getResources
);

/**
 * @route   GET /api/resources/:id
 * @desc    Get single resource by ID
 * @access  Authenticated users
 */
router.get(
  '/:id',
  authenticate,
  resourceController.getResourceById
);

/**
 * @route   DELETE /api/resources/:id
 * @desc    Soft or permanent delete a resource
 * @access  Admin only
 */
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  resourceController.deleteResource
);

/**
 * @route   POST /api/resources/:id/retry-ocr
 * @desc    Retry OCR processing for a resource
 * @access  Admin only
 */
router.post(
  '/:id/retry-ocr',
  authenticate,
  authorize('admin'),
  resourceController.retryOCR
);

/**
 * @route   GET /api/resources/:id/ocr-status
 * @desc    Get OCR processing status
 * @access  Authenticated users
 */
router.get(
  '/:id/ocr-status',
  authenticate,
  resourceController.getOCRStatus
);

module.exports = router;