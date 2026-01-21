const Resource = require('../models/Resource');
const ocrService = require('../utils/ocrService');
const fs = require('fs').promises;
const path = require('path');

/**
 * Upload and process a resource file
 * POST /api/resources/upload
 * Admin only  
 */
exports.uploadResource = async (req, res) => {
    try {
        // Checking for file
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded',
            });
        }

        const { title, description, subject, tags } = req.body;

        // Validate required fields
        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Title is required',
            });
        }

        // Determine File type
        let fileType = 'document';
        if (req.file.mimetype === 'application/pdf') {
            fileType = 'pdf';
        } else if (req.file.mimetype.startsWith('image/')) {
            fileType = 'image';
        }

        // Create resource document - FIXED: use lowercase variable name
        const resource = await Resource.create({
            title,
            description,
            originalFileName: req.file.originalname,
            filename: req.file.filename,
            filePath: req.file.path,
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
        console.error('Error uploading resource:', error);
        
        // Clean up uploaded file if error occurs - FIXED: fs instead of fc
        if (req.file) {
            await fs.unlink(req.file.path).catch(() => {});
        }
        res.status(500).json({
            success: false,
            message: 'Server error during file upload',
        });
    }
};

/**
 * Async OCR processing function
 */
async function processOCR(resourceId, filePath, mimeType) {
    try {
        console.log(`Starting OCR for resource ${resourceId}`);

        // Update resource status to processing
        await Resource.findByIdAndUpdate(resourceId, { 
            ocrStatus: 'processing' 
        });

        // Extract text 
        const result = await ocrService.extractText(filePath, mimeType);

        // Update resource with extracted text
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
exports.updateResource = async (req, res) => {
    try {
        const { title, description, subject, tags } = req.body;
        const resource = await Resource.findById(req.params.id);

        if (!resource || resource.isDeleted) {
            return res.status(404).json({
                success: false,
                message: 'Resource not found',
            });
        }

        // Update fields
        if (title) resource.title = title;
        if (description !== undefined) resource.description = description;
        if (subject !== undefined) resource.subject = subject;
        if (tags) resource.tags = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());
    
        await resource.save();

        res.json({
            success: true,
            message: 'Resource updated successfully',
            data: { resource }
        });
    } catch (error) {
        console.error('Update resource error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating resource',
            error: error.message
        });
    }
};

/**
 * Delete resource (soft delete)
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
            // Permanent delete - remove from DB and delete file - FIXED: fs instead of fc
            await fs.unlink(resource.filePath).catch(() => {});
            await Resource.findByIdAndDelete(req.params.id);

            return res.json({
                success: true,
                message: 'Resource permanently deleted',
            });
        } else {
            // Soft delete 
            resource.isDeleted = true;
            resource.deletedAt = new Date();
            await resource.save();

            // Optionally delete file after processing - FIXED: fs instead of fc, req instead of res
            if (req.query.deleteFile === 'true') {
                await fs.unlink(resource.filePath).catch(() => {});
            }

            return res.json({
                success: true,
                message: 'Resource deleted successfully',
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
 * Retry OCR processing for failed resources
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

        if (resource.ocrStatus === 'processing') { // FIXED: processing not proccessing
            return res.status(400).json({
                success: false,
                message: 'OCR is already in processing',
            });
        }

        // Check if file exists - FIXED: fs instead of fc
        try {
            await fs.access(resource.filePath);
        } catch {
            return res.status(400).json({
                success: false,
                message: 'Resource file not found',
            });
        }

        // Restart OCR processing
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
