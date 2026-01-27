const express = require('express');
const router = express.Router();
const resourceController = require('../controllers/resourceController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

/**
 * @route   POST /api/resources
 * @desc    Upload a new resource
 * @access  Private
 */

router.post(
    '/upload',
    authenticate,
    
    upload.single('file'),
    resourceController.uploadResource
);

/**
 * @route   GET /api/resources
 * @desc    Get all resources with filtersa
 * @access  Private
 */

router.get(
    '/',
    authenticate,
    resourceController.getResources
);

/**
 * @route   GET /api/resources/:id
 * @desc    Get single resource by ID
 * @access  Admin only
 */
router.get(
    '/:id',
    authenticate,
    resourceController.getResourceById
);

/**
 * @route PUT /api/resources/:id
 * @desc  Update resource metadata
 * @access Admin only
 */

// router.put(
//     '/:id',
//     authenticate,
//     resourceController.updateResource
// );

/**
 * @route DELETE /api/resources/:id
 * @desc  Soft delete a resource
 * @access Admin only
 */
router.delete(
    '/:id',
    authenticate,
    
    resourceController.deleteResource
);

router.post(
    '/:id/retry-ocr',
    authenticate,
    
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
