const Resource = require('../models/Resource');
const ocrService = require('../utils/ocrService');
const fs = require('fs').promises;
const path = require('path');
const streamifier = require('streamifier');
const cloudinary = require('../utils/cloudinary');

/**
 * Helper function to upload file to Cloudinary
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
 * Upload and process a resource file
 * POST /api/resources/upload
 * Admin only  
 */
exports.uploadResource = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { title, description, subject, tags } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    // Determine file type
    let fileType = 'document';
    if (req.file.mimetype === 'application/pdf') fileType = 'pdf';
    else if (req.file.mimetype.startsWith('image/')) fileType = 'image';

    // Upload file to Cloudinary
    const resourceType = fileType === 'image' ? 'image' : 'raw';
    const uploadedFile = await uploadToCloudinary(req.file.buffer, resourceType);

    // Save resource in MongoDB with ALL required fields
    const resource = await Resource.create({
      title,
      description,
      fileType,
      originalFileName: req.file.originalname,
      filename: uploadedFile.public_id,      // Required field - Cloudinary ID
      filePath: uploadedFile.secure_url,     // Required field - URL
      fileSize: req.file.size,               // Required field - File size
      mimetype: req.file.mimetype,
      uploadedBy: req.user._id,
      subject,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    });

    // Start OCR processing asynchronously
    processOCR(resource._id, resource.filePath, req.file.mimetype);

    res.status(201).json({ 
      success: true, 
      message: 'Resource uploaded successfully', 
      data: resource 
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
 * Async OCR processing function
 */
async function processOCR(resourceId, filePath, mimeType) {
  try {
    console.log(`Starting OCR for resource ${resourceId}`);

    await Resource.findByIdAndUpdate(resourceId, { ocrStatus: 'processing' });

    const result = await ocrService.extractText(filePath, mimeType);

    await Resource.findByIdAndUpdate(resourceId, {
      extractedText: result,
      ocrStatus: 'completed',
      isProcessed: true
    });

    console.log(`OCR completed for resource ${resourceId}. Extracted ${result.length} characters.`);
  } catch (error) {
    console.error(`OCR failed for resource ${resourceId}:`, error);

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
      .select('-extractedText');

    const count = await Resource.countDocuments(query);

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
      .populate('generatedQuizzes', 'title totalQuestions createdAt');

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
      message: 'Failed to fetch OCR status',
      error: error.message
    });
  }
};

module.exports = exports;