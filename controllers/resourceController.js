const Resource = require('../models/Resource');
const ocrService = require('../utils/ocrService');
const fs = require('fs').promises;
const path = require('path');
const Resource = require('../models/Resource');
const ocrService = require('../utils/ocrService');
const fs = require('fs').promises;
const cloudinary = require('../utils/cloudinary');
const streamifier = require('streamifier');

/**
 * Helper: promisified Cloudinary upload
 */
function uploadToCloudinary(fileBuffer, options) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
            if (error) return reject(error);
            resolve(result);
        });
        streamifier.createReadStream(fileBuffer).pipe(stream);
    });
}

/**
 * Upload a new resource
 * POST /api/resources/upload
 * Admin only
 */
exports.uploadResource = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded',
            });
        }

        const { title, description, subject, tags } = req.body;
        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Title is required',
            });
        }

        // Determine file type
        let fileType = 'document';
        if (req.file.mimetype === 'application/pdf') fileType = 'pdf';
        else if (req.file.mimetype.startsWith('image/')) fileType = 'image';

        // Upload file to Cloudinary
        const uploadedFile = await uploadToCloudinary(req.file.buffer, {
            resource_type: fileType === 'image' ? 'image' : 'raw',
            folder: 'resources'
        });

        // Save resource in MongoDB
        const resource = await Resource.create({
            title,
            description,
            originalFileName: req.file.originalname,
            filename: uploadedFile.public_id,
            filePath: uploadedFile.secure_url,
            fileType,
            mimetype: req.file.mimetype,
            fileSize: req.file.size,
            uploadedBy: req.user._id,
            subject,
            tags: tags ? tags.split(',').map(tag => tag.trim()) : []
        });

        // Start OCR processing asynchronously
        processOCR(resource._id, resource.filePath, req.file.mimetype);

        res.status(201).json({
            success: true,
            message: 'Resource uploaded successfully',
            data: {
                id: resource._id,
                title: resource.title,
                fileType: resource.fileType,
                ocrStatus: resource.ocrStatus
            }
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during file upload',
            error: error.message
        });
    }
};

/**
 * OCR processing function
 */
async function processOCR(resourceId, filePath, mimeType) {
    try {
        await Resource.findByIdAndUpdate(resourceId, { ocrStatus: 'processing' });

        const result = await ocrService.extractText(filePath, mimeType);

        await Resource.findByIdAndUpdate(resourceId, {
            extractedText: result,
            ocrStatus: 'completed',
            isProcessed: true
        });

        console.log(`OCR completed for ${resourceId}: ${result.length} characters.`);
    } catch (error) {
        console.error(`OCR failed for ${resourceId}:`, error);
        await Resource.findByIdAndUpdate(resourceId, {
            ocrStatus: 'failed',
            ocrError: error.message
        });
    }
}

/**
 * Get all resources
 * GET /api/resources
 */
exports.getResources = async (req, res) => {
    try {
        const { page = 1, limit = 20, subject, fileType, ocrStatus } = req.query;

        // Build query 
        const query = { isDeleted: false };

        if (subject) query.subject = subject;
        if (fileType) query.fileType = fileType;
        if (ocrStatus) query.ocrStatus = ocrStatus;

        // Execute query with pagination
        const resources = await Resource.find(query)
            .populate('uploadedBy', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .select('-extractedText'); // FIXED: extractedText not extractedTest

        const count = await Resource.countDocuments(query); // FIXED: count not cout

        res.json({
            success: true,
            data: {
                resources,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                total: count
            }
        });
    } catch (error) {
        console.error('Error fetching resources:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching resources',
            error: error.message
        });
    }
};

/** 
 * Get single resource by ID
 * GET /api/resources/:id
 */
exports.getResourceById = async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id)
            .populate('uploadedBy', 'firstName lastName email')
            .populate('generatedQuizzes', 'title totalQuestions createdAt'); // FIXED: generatedQuizzes

        if (!resource || resource.isDeleted) {
            return res.status(404).json({
                success: false, 
                message: 'Resource not found',
            });
        }
        res.json({
            success: true,
            data: { resource }
        });
    } catch (error) {
        console.error('Get resource error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching resource',
            error: error.message
        });
    }   
};

/**
 * Update resource metadata 
 * PUT /api/resources/:id
 * Admin only
 */


exports.uploadResource = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const { title, description, subject, tags } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    // Upload file to Cloudinary
    const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'document';
    let uploadedFile;

    if (fileType === 'image') {
      uploadedFile = await cloudinary.uploader.upload_stream({
        resource_type: 'image',
        folder: 'resources'
      }, (error, result) => {
        if (error) throw error;
        return result;
      });

      // multer memory buffer to stream
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'resources' },
        async (error, result) => {
          if (error) throw error;
          // Save resource in DB here after upload
        }
      );
      stream.end(req.file.buffer);
    } else {
      // For PDFs/documents
      uploadedFile = await cloudinary.uploader.upload_stream({
        resource_type: 'raw',
        folder: 'resources'
      }, (error, result) => {
        if (error) throw error;
        return result;
      });

      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'raw', folder: 'resources' },
        async (error, result) => {
          if (error) throw error;
          // Save resource in DB here
        }
      );
      stream.end(req.file.buffer);
    }

    // Save resource in MongoDB
    const resource = await Resource.create({
      title,
      description,
      fileType,
      originalFileName: req.file.originalname,
      filePath: uploadedFile.secure_url,
      mimetype: req.file.mimetype,
      uploadedBy: req.user._id,
      subject,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    });

    // Start OCR processing (you might need to download from Cloudinary for PDFs/images)
    processOCR(resource._id, resource.filePath, req.file.mimetype);

    res.status(201).json({ success: true, message: 'Resource uploaded successfully', data: resource });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: 'Server error during file upload', error: error.message });
  }
};

/**
 * Delete resource (soft or permanent)
 * DELETE /api/resources/:id
 * Admin only
 */
exports.deleteResource = async (req, res) => {
    try {
        const { permanent = false } = req.query;
        const resource = await Resource.findById(req.params.id);

        if (!resource) {
            return res.status(404).json({
                success: false,
                message: 'Resource not found',
            });
        }

        if (permanent === 'true') {
            // Delete from Cloudinary
            const resourceType = resource.fileType === 'image' ? 'image' : 'raw';
            await cloudinary.uploader.destroy(resource.filename, { resource_type: resourceType });

            // Delete from DB
            await Resource.findByIdAndDelete(req.params.id);

            return res.json({
                success: true,
                message: 'Resource permanently deleted',
            });
        } else {
            // Soft delete in DB
            resource.isDeleted = true;
            resource.deletedAt = new Date();
            await resource.save();

            return res.json({
                success: true,
                message: 'Resource deleted successfully (soft delete)',
            });
        }
    } catch (error) {
        console.error('Delete resource error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deleting resource',
            error: error.message
        });
    }
};

/**
 * Retry OCR processing for a resource
 * POST /api/resources/:id/retry-ocr
 * Admin only
 */
exports.retryOCR = async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);

        if (!resource || resource.isDeleted) {
            return res.status(404).json({
                success: false,
                message: 'Resource not found',
            });
        }

        if (resource.ocrStatus === 'processing') {
            return res.status(400).json({
                success: false,
                message: 'OCR is already in processing',
            });
        }

        // Start OCR directly using Cloudinary URL
        processOCR(resource._id, resource.filePath, resource.mimetype);

        res.json({
            success: true,
            message: 'OCR retry started',
        });
    } catch (error) {
        console.error('Retry OCR error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error retrying OCR',
            error: error.message
        });
    }
};

/**
 * Get OCR status of a resource
 * GET /api/resources/:id/ocr-status
 */
exports.getOCRStatus = async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id)
            .select('ocrStatus ocrError extractedText');

        if (!resource) {
            return res.status(404).json({
                success: false,
                message: 'Resource not found',
            });
        }
        res.json({
            success: true,
            data: {
                ocrStatus: resource.ocrStatus,
                ocrError: resource.ocrError,
                hasExtractedText: !!resource.extractedText,
                textLength: resource.extractedText ? resource.extractedText.length : 0
            }
        });
    } catch (error) {
        console.error('Get OCR status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch OCR status', // FIXED: Failed not Faild
            error: error.message
        });
    }
};

module.exports = exports;