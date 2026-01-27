const { default: mongoose } = require('mongoose');
const mangoose = require('mongoose');

const resourceSchema = new mangoose.Schema({
    // File information
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    url: {
        type: String,
        required: false,
        trim: true
    },
    
    // File details
    originalFileName: {
        type: String,
        required: true,
    },
    filename: {
        type: String,
        required: true,
    },
    filePath: {
        type: String,
        required: true,
   },
    fileType: {
        type: String,
        enum: ['pdf', 'image', 'document'],
        required: true
    },
    fileSize: {
        type: Number,
        required: true,
    },

    //OCR extracted text
    extractedText: {
        type: String,
        default: ''
    },
    ocrStatus: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    ocrError: String,

    // Processing status
    isProcessed: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: Date,

    // Metadata
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        req: 'User',
        required: true
    },
    subject: {
        type: String,
        trim: true
    },
    tags: [{
        type: String,
        trim: true
    }],

    // Quizz generation 
    quizGenerated: {   
        type: Boolean,
        default: false
    },
    generatedQuiz: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz'
    }],
}, { timestamps: true});

resourceSchema.index({uploadedBy: 1, createdAt: -1});
resourceSchema.index({ocrStatus: 1});
resourceSchema.index({isDeleted: 1});

module.exports = mongoose.model('Resource', resourceSchema);