const Anthropic = require('@anthropic-ai/sdk');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class OCRService {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Main entry point for text extraction
   * Handles both local file paths and Cloudinary URLs
   */
  async extractText(filePathOrUrl, mimeType) {
    try {
      console.log(`Starting text extraction for: ${filePathOrUrl}`);
      console.log(`MIME type: ${mimeType}`);

      // Determine if we need to download the file first
      let localFilePath = filePathOrUrl;
      let shouldCleanup = false;

      // If it's a URL (Cloudinary), download it first
      if (filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://')) {
        console.log('Detected remote file, downloading from Cloudinary...');
        localFilePath = await this.downloadFile(filePathOrUrl, mimeType);
        shouldCleanup = true;
        console.log(`File downloaded to: ${localFilePath}`);
      }

      let extractedText = '';

      try {
        // Route to appropriate extraction method based on MIME type
        if (mimeType === 'application/pdf') {
          extractedText = await this.extractFromPDF(localFilePath);
        } else if (mimeType.startsWith('image/')) {
          extractedText = await this.extractFromImage(localFilePath);
        } else if (mimeType === 'text/plain') {
          extractedText = await this.extractFromText(localFilePath);
        } else {
          throw new Error(`Unsupported file type: ${mimeType}`);
        }

        console.log(`Successfully extracted ${extractedText.length} characters`);
        return extractedText;

      } finally {
        // Clean up downloaded file if it was temporary
        if (shouldCleanup && localFilePath) {
          try {
            await fs.unlink(localFilePath);
            console.log(`Cleaned up temporary file: ${localFilePath}`);
          } catch (cleanupError) {
            console.error(`Failed to cleanup temporary file: ${cleanupError.message}`);
          }
        }
      }

    } catch (error) {
      console.error('OCR extraction error:', error);
      throw new Error(`Failed to extract text: ${error.message}`);
    }
  }

  /**
   * Download file from URL to temporary location
   */
  async downloadFile(url, mimeType) {
    try {
      // Determine file extension
      let extension = '.bin';
      if (mimeType === 'application/pdf') extension = '.pdf';
      else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') extension = '.jpg';
      else if (mimeType === 'image/png') extension = '.png';
      else if (mimeType === 'image/gif') extension = '.gif';
      else if (mimeType === 'text/plain') extension = '.txt';

      // Create temporary file path
      const tempDir = os.tmpdir();
      const tempFileName = `ocr-${Date.now()}-${Math.random().toString(36).substring(7)}${extension}`;
      const tempFilePath = path.join(tempDir, tempFileName);

      console.log(`Downloading file from: ${url}`);
      console.log(`Saving to: ${tempFilePath}`);

      // Download file with axios
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'arraybuffer',
        timeout: 60000, // 60 second timeout
        headers: {
          'User-Agent': 'BrainQuest-OCR-Service/1.0'
        }
      });

      // Save to temporary file
      await fs.writeFile(tempFilePath, response.data);

      // Verify file was written
      const stats = await fs.stat(tempFilePath);
      console.log(`File downloaded successfully. Size: ${stats.size} bytes`);

      return tempFilePath;

    } catch (error) {
      console.error('File download error:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw new Error(`Failed to download file from URL: ${error.message}`);
    }
  }

  /**
   * Extract text from PDF using pdf-parse
   */
  async extractFromPDF(filePath) {
    try {
      console.log(`Reading PDF from: ${filePath}`);
      
      // Read the file as a buffer
      const dataBuffer = await fs.readFile(filePath);
      
      console.log(`PDF file read, size: ${dataBuffer.length} bytes`);
      
      // Parse PDF
      const data = await pdfParse(dataBuffer);
      
      const text = data.text.trim();
      console.log(`Extracted ${text.length} characters from PDF`);
      
      if (!text || text.length < 10) {
        throw new Error('PDF appears to be empty or contains only images. OCR for image-based PDFs coming soon.');
      }
      
      return text;
      
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }

  /**
   * Extract text from image using Tesseract.js
   */
  async extractFromImage(filePath) {
    try {
      console.log(`Processing image with Tesseract: ${filePath}`);
      
      // Perform OCR
      const result = await Tesseract.recognize(filePath, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      
      const text = result.data.text.trim();
      console.log(`Extracted ${text.length} characters from image`);
      
      if (!text || text.length < 10) {
        throw new Error('Image appears to contain no readable text');
      }
      
      return text;
      
    } catch (error) {
      console.error('Image OCR error:', error);
      throw new Error(`Failed to extract text from image: ${error.message}`);
    }
  }

  /**
   * Extract text from plain text file
   */
  async extractFromText(filePath) {
    try {
      console.log(`Reading text file: ${filePath}`);
      
      const text = await fs.readFile(filePath, 'utf-8');
      
      console.log(`Read ${text.length} characters from text file`);
      
      if (!text || text.trim().length < 10) {
        throw new Error('Text file appears to be empty');
      }
      
      return text.trim();
      
    } catch (error) {
      console.error('Text file reading error:', error);
      throw new Error(`Failed to read text file: ${error.message}`);
    }
  }

  /**
   * Optional: Use Claude Vision API for image-based PDFs or complex images
   * This is useful when standard OCR fails
   */
  async extractWithClaudeVision(imageUrl) {
    try {
      console.log('Using Claude Vision API for text extraction');
      
      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'url',
                  url: imageUrl,
                },
              },
              {
                type: 'text',
                text: 'Please extract all text from this image. Preserve the structure and formatting as much as possible. Return only the extracted text, no additional commentary.',
              },
            ],
          },
        ],
      });
      
      const extractedText = message.content[0].text;
      console.log(`Claude Vision extracted ${extractedText.length} characters`);
      
      return extractedText;
      
    } catch (error) {
      console.error('Claude Vision extraction error:', error);
      throw new Error(`Failed to extract text with Claude Vision: ${error.message}`);
    }
  }
}

module.exports = new OCRService();