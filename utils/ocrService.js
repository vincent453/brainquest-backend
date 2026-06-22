const Tesseract = require('tesseract.js');
const { createWorker } = Tesseract;
const pdf = require('pdf-parse');
const fs = require('fs').promises;
const path = require('path');

/**
 * OCR Service for extracting text from various file types
 * FIXED: Handles Cloudinary URLs and undefined mimeTypes
 */
class OCRService {
  constructor() {
    this.worker = null;
  }

  /**
   * Initialize Tesseract worker
   */
  async initWorker() {
    if (!this.worker) {
      this.worker = await createWorker('eng');
      console.log('Tesseract worker initialized');
    }
    return this.worker;
  }

  /**
   * Terminate Tesseract worker
   */
  async terminateWorker() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      console.log('Tesseract worker terminated');
    }
  }

  /**
   * Extract text from image using Tesseract OCR
   * @param {string} imagePath - Path to the image file
   * @returns {Promise<string>} - Extracted text
   */
  async extractFromImage(imagePath) {
    try {
      await this.initWorker();
      
      const { data: { text } } = await this.worker.recognize(imagePath);
      
      // Clean up the extracted text
      const cleanedText = this.cleanText(text);
      
      return cleanedText;
    } catch (error) {
      console.error('Error extracting text from image:', error);
      throw new Error(`Failed to extract text from image: ${error.message}`);
    }
  }

  /**
   * Extract text from PDF using pdf-parse
   * @param {string} pdfPath - Path to the PDF file
   * @returns {Promise<string>} - Extracted text
   */
  async extractFromPDF(pdfPath) {
    try {
      const dataBuffer = await fs.readFile(pdfPath);
      const data = await pdf(dataBuffer);
      
      // Clean up the extracted text
      const cleanedText = this.cleanText(data.text);
      
      return cleanedText;
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }

  /**
   * Detect file type from file path or URL
   * @param {string} filePath - Path or URL to the file
   * @returns {string} - Detected file type
   */
  detectFileType(filePath) {
    const lowercasePath = (filePath || '').toLowerCase();
    
    // Check file extension
    if (lowercasePath.endsWith('.pdf')) return 'pdf';
    if (lowercasePath.endsWith('.jpg') || lowercasePath.endsWith('.jpeg')) return 'image';
    if (lowercasePath.endsWith('.png')) return 'image';
    if (lowercasePath.endsWith('.gif')) return 'image';
    if (lowercasePath.endsWith('.txt')) return 'text';
    
    // If no extension found, return null
    return null;
  }

  /**
   * Extract text from document based on file type
   * @param {string} filePath - Path to the file (can be local path or Cloudinary URL)
   * @param {string} mimeType - MIME type of the file (may be undefined for Cloudinary)
   * @returns {Promise<string>} - Extracted text
   */
  async extractText(filePath, mimeType) {
    try {
      console.log('Starting text extraction for:', filePath);
      console.log('MIME type:', mimeType);

      // If mimeType is undefined, try to detect from file path
      let detectedType = mimeType;
      
      if (!detectedType || detectedType === 'undefined') {
        console.log('MIME type undefined, detecting from file path...');
        const fileType = this.detectFileType(filePath);
        
        if (fileType === 'pdf') {
          detectedType = 'application/pdf';
        } else if (fileType === 'image') {
          detectedType = 'image/jpeg'; // Generic image type
        } else if (fileType === 'text') {
          detectedType = 'text/plain';
        } else {
          // Default to PDF if can't detect
          console.log('Could not detect file type, defaulting to PDF');
          detectedType = 'application/pdf';
        }
        
        console.log('Detected type:', detectedType);
      }

      // Handle Cloudinary URLs
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        console.log('Detected remote file, downloading from Cloudinary...');
        filePath = await this.downloadCloudinaryFile(filePath);
        console.log('File downloaded to:', filePath);
      }

      // Check if file exists (for local files)
      try {
        await fs.access(filePath);
      } catch (error) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Determine extraction method based on MIME type
      if (detectedType === 'application/pdf') {
        console.log('Extracting from PDF...');
        return await this.extractFromPDF(filePath);
      } else if (detectedType.startsWith('image/')) {
        console.log('Extracting from image...');
        return await this.extractFromImage(filePath);
      } else if (detectedType === 'text/plain') {
        console.log('Reading text file...');
        // For plain text files, just read the content
        const content = await fs.readFile(filePath, 'utf-8');
        return this.cleanText(content);
      } else {
        throw new Error(`Unsupported file type: ${detectedType}`);
      }
    } catch (error) {
      console.error('Error in extractText:', error);
      throw error;
    }
  }

  /**
   * Download file from Cloudinary URL to temporary location
   * @param {string} url - Cloudinary URL
   * @returns {Promise<string>} - Path to downloaded file
   */
  async downloadCloudinaryFile(url) {
    const https = require('https');
    const http = require('http');
    const os = require('os');
    const crypto = require('crypto');

    return new Promise((resolve, reject) => {
      const tempFileName = `ocr-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.bin`;
      const tempFilePath = path.join(os.tmpdir(), tempFileName);
      
      console.log('Downloading file from:', url);
      console.log('Saving to:', tempFilePath);

      const protocol = url.startsWith('https') ? https : http;
      
      const file = require('fs').createWriteStream(tempFilePath);
      
      protocol.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download file: ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log('File downloaded successfully. Size:', file.bytesWritten, 'bytes');
          resolve(tempFilePath);
        });
      }).on('error', (error) => {
        require('fs').unlink(tempFilePath, () => {}); // Delete incomplete file
        reject(error);
      });

      file.on('error', (error) => {
        require('fs').unlink(tempFilePath, () => {}); // Delete incomplete file
        reject(error);
      });
    });
  }

  /**
   * Clean and normalize extracted text
   * @param {string} text - Raw extracted text
   * @returns {string} - Cleaned text
   */
  cleanText(text) {
    if (!text) return '';
    
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove excessive line breaks
      .replace(/\n{3,}/g, '\n\n')
      // Trim whitespace
      .trim();
  }

  /**
   * Split text into manageable chunks for AI processing
   * @param {string} text - Text to split
   * @param {number} maxChunkSize - Maximum size of each chunk
   * @returns {Array<string>} - Array of text chunks
   */
  splitTextIntoChunks(text, maxChunkSize = 3000) {
    const words = text.split(' ');
    const chunks = [];
    let currentChunk = '';

    for (const word of words) {
      if ((currentChunk + ' ' + word).length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = word;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + word;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Validate if extracted text is meaningful
   * @param {string} text - Extracted text
   * @returns {boolean} - True if text is valid
   */
  isValidText(text) {
    if (!text || text.trim().length < 50) {
      return false;
    }

    // Check if text contains enough readable words
    const words = text.split(/\s+/).filter(word => word.length > 2);
    return words.length >= 10;
  }
}

// Export a singleton instance
module.exports = new OCRService();