const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const sharp = require('sharp');
const path = require('path');

/**
 * OCR service - Extract text from pdf and image files
 * Supports: PDF, JPG, PNG, JPG, JPEG, WEBP
 */

class OCRService {
    /**
     * Main method to extract text based on file type
     * @param {String} filePath - Path to the file
     * @param {String} mimeType - MIME type of the file
     * @returns {Promise<{text: string, confidence?:number}>}
     */ 
    async extractText(filePath, mineType) {
     try {
      console.log(`Starting text extraction for: ${filePath}`);
      
      if (mimeType === 'application/pdf') {
        return await this.extractFromPDF(filePath);
      } else if (mimeType.startsWith('image/')) {
        return await this.extractFromImage(filePath);
      } else {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }
    } catch (error) {
      console.error('OCR extraction error:', error);
      throw error;
    }
  }

  /**
   * Extract text from PDF file
   * @param {String} filePath - Path to the PDF file
   * @returns {Promise<{text: string}>}
   */
  async extractFromPDF(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);

      console.log(`PDF parsed: ${pdfData.numpages} pages, ${pdfData.text.length} characters`);

      return {
        text: pdfData.text.trim(),
        pages: pdfData.numpages,
        metadata: pdfData.info
      };
    
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }
   /**
    * Extract text from image file Using Tesseract OCS
    * @param {String} filePath - Path to the image file
    * @returns {Promise<{text: string, confidence:number}>}
    */
  async extractFromImage(filePath) {

    try {
      // Preprocess image for better OCR results
      const processedImagePath = await this.preprocessImage(filePath);
      
      console.log('Running Tesseract OCR...');
      
      const { data: { text, confidence } } = await Tesseract.recognize(
        processedImagePath,
        'eng',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      );
      
      // Clean up processed image if it's different from original
      if (processedImagePath !== filePath) {
        await fs.unlink(processedImagePath).catch(() => {});
      }
      
      console.log(`OCR completed with confidence: ${confidence}%`);
      
      return {
        text: text.trim(),
        confidence: Math.round(confidence)
      };
    } catch (error) {
      console.error('Image OCR error:', error);
      throw new Error(`Failed to extract text from image: ${error.message}`);
    }
  
  }

  /**
   * Process image to enhance OCR accuracy
   * @param {String} imagePath - Path to the image file
   * @returns {Promise<String>} - Path to the processed image 
   * 
   */
  async preprocessImage(imagePath) {
    try {
      const processedPath = imagePath.replace(
        path.extname(imagePath),
        '_processed.png'
      );
      
      // Enhance image for better OCR
      await sharp(imagePath)
        .greyscale() // Convert to grayscale
        .normalize() // Normalize contrast
        .sharpen() // Sharpen edges
        .png() // Convert to PNG for consistency
        .toFile(processedPath);
      
      return processedPath;
    } catch (error) {
      console.warn('Image preprocessing failed, using original:', error.message);
      return imagePath;
    }
  }
  
   /**
   * Extract text from multiple files in batch
   * @param {Array<{path: string, mimeType: string}>} files
   * @returns {Promise<Array<{text: string, confidence?: number, error?: string}>>}
   */

   async extractFromMultiple(files) {
    const results = [];
    
    for (const file of files) {
      try {
        const result = await this.extractText(file.path, file.mimeType);
        results.push({ ...result, success: true });
      } catch (error) {
        results.push({ 
          text: '', 
          success: false, 
          error: error.message 
        });
      }
    }
    
    return results;
  }
  
  /**
   * Validate if extracted text is sufficient for quiz generation
   * @param {string} text - Extracted text
   * @returns {boolean}
   */
  isTextSufficient(text) {
    if (!text || text.trim().length < 100) {
      return false;
    }
    
    // Check for minimum word count
    const words = text.trim().split(/\s+/);
    return words.length >= 50;
  }
}

module.exports = new OCRService();

