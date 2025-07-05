// src/screen/capturer.js - Screen Capture for AI Analysis
const screenshot = require('screenshot-desktop');
const Jimp = require('jimp');
const fs = require('fs').promises;
const path = require('path');
const Logger = require('../utils/logger');

class ScreenCapturer {
  constructor() {
    this.outputPath = path.join(__dirname, '../../temp');
    this.ensureTempDirectory();
    
    // Screenshot options
    this.options = {
      format: process.env.SCREENSHOT_FORMAT || 'jpeg',
      quality: parseFloat(process.env.SCREENSHOT_QUALITY) || 0.8,
      screen: 0, // Primary display
    };
    
    Logger.info('Screen capturer initialized');
  }

  async ensureTempDirectory() {
    try {
      await fs.mkdir(this.outputPath, { recursive: true });
    } catch (error) {
      Logger.error('Failed to create temp directory:', error);
    }
  }

  /**
   * Capture full screen
   * @returns {Promise<Buffer>} Screenshot buffer
   */
  async captureScreen() {
    try {
      Logger.info('Capturing full screen...');
      
      const img = await screenshot({ format: 'png' });
      
      // Process image with Jimp for optimization
      const jimpImage = await Jimp.read(img);
      
      // Resize if too large (Gemini has size limits)
      const maxWidth = 1920;
      const maxHeight = 1080;
      
      if (jimpImage.getWidth() > maxWidth || jimpImage.getHeight() > maxHeight) {
        jimpImage.scaleToFit(maxWidth, maxHeight);
        Logger.info('Screenshot resized for AI processing');
      }
      
      // Convert to JPEG with quality setting
      const buffer = await jimpImage.quality(Math.round(this.options.quality * 100)).getBufferAsync(Jimp.MIME_JPEG);
      
      Logger.info('Screen capture completed');
      return buffer;
      
    } catch (error) {
      Logger.error('Screen capture failed:', error);
      throw new Error(`Screenshot failed: ${error.message}`);
    }
  }

  /**
   * Capture specific region of screen
   * @param {Object} region - {x, y, width, height}
   * @returns {Promise<Buffer>} Screenshot buffer
   */
  async captureRegion(region) {
    try {
      Logger.info('Capturing screen region:', region);
      
      // Capture full screen first
      const fullScreen = await this.captureScreen();
      
      // Crop to specified region using Jimp
      const jimpImage = await Jimp.read(fullScreen);
      const cropped = jimpImage.crop(region.x, region.y, region.width, region.height);
      
      const buffer = await cropped.quality(Math.round(this.options.quality * 100)).getBufferAsync(Jimp.MIME_JPEG);
      
      Logger.info('Region capture completed');
      return buffer;
      
    } catch (error) {
      Logger.error('Region capture failed:', error);
      throw new Error(`Region screenshot failed: ${error.message}`);
    }
  }

  /**
   * Capture screen and save to file
   * @param {string} filename - Optional filename
   * @returns {Promise<string>} Path to saved file
   */
  async captureAndSave(filename = null) {
    try {
      const timestamp = Date.now();
      const fileName = filename || `screenshot_${timestamp}.jpg`;
      const filePath = path.join(this.outputPath, fileName);
      
      const buffer = await this.captureScreen();
      await fs.writeFile(filePath, buffer);
      
      Logger.info('Screenshot saved:', filePath);
      return filePath;
      
    } catch (error) {
      Logger.error('Save screenshot failed:', error);
      throw new Error(`Save screenshot failed: ${error.message}`);
    }
  }

  /**
   * Capture multiple displays
   * @returns {Promise<Array<Buffer>>} Array of screenshot buffers
   */
  async captureAllDisplays() {
    try {
      Logger.info('Capturing all displays...');
      
      // Get list of displays
      const displays = await screenshot.listDisplays();
      const screenshots = [];
      
      for (let i = 0; i < displays.length; i++) {
        try {
          const img = await screenshot({ format: 'png', screen: i });
          const jimpImage = await Jimp.read(img);
          
          // Optimize for AI processing
          if (jimpImage.getWidth() > 1920 || jimpImage.getHeight() > 1080) {
            jimpImage.scaleToFit(1920, 1080);
          }
          
          const buffer = await jimpImage.quality(80).getBufferAsync(Jimp.MIME_JPEG);
          screenshots.push(buffer);
          
        } catch (displayError) {
          Logger.warn(`Failed to capture display ${i}:`, displayError.message);
        }
      }
      
      Logger.info(`Captured ${screenshots.length} displays`);
      return screenshots;
      
    } catch (error) {
      Logger.error('Multi-display capture failed:', error);
      throw new Error(`Multi-display capture failed: ${error.message}`);
    }
  }

  /**
   * Capture window by title
   * @param {string} windowTitle - Partial window title to match
   * @returns {Promise<Buffer>} Screenshot buffer
   */
  async captureWindow(windowTitle) {
    try {
      Logger.info('Capturing window:', windowTitle);
      
      // This is a simplified implementation
      // In practice, you'd need platform-specific window enumeration
      const fullScreen = await this.captureScreen();
      
      // For now, return full screen
      // TODO: Implement actual window detection and capture
      Logger.warn('Window-specific capture not fully implemented, returning full screen');
      return fullScreen;
      
    } catch (error) {
      Logger.error('Window capture failed:', error);
      throw new Error(`Window capture failed: ${error.message}`);
    }
  }

  /**
   * Get screen information
   * @returns {Promise<Object>} Screen info
   */
  async getScreenInfo() {
    try {
      const displays = await screenshot.listDisplays();
      
      const screenInfo = {
        displayCount: displays.length,
        displays: displays.map((display, index) => ({
          id: index,
          bounds: display.bounds || null,
          primary: index === 0
        }))
      };
      
      Logger.info('Screen info retrieved:', screenInfo);
      return screenInfo;
      
    } catch (error) {
      Logger.error('Failed to get screen info:', error);
      return {
        displayCount: 1,
        displays: [{ id: 0, bounds: null, primary: true }]
      };
    }
  }

  /**
   * Optimize image for AI processing
   * @param {Buffer} imageBuffer - Input image buffer
   * @returns {Promise<Buffer>} Optimized image buffer
   */
  async optimizeForAI(imageBuffer) {
    try {
      const jimpImage = await Jimp.read(imageBuffer);
      
      // Resize if needed
      const maxDimension = 2048;
      if (jimpImage.getWidth() > maxDimension || jimpImage.getHeight() > maxDimension) {
        jimpImage.scaleToFit(maxDimension, maxDimension);
      }
      
      // Enhance contrast and brightness for better AI analysis
      jimpImage.contrast(0.1).brightness(0.05);
      
      // Convert to JPEG with good quality
      const optimized = await jimpImage.quality(85).getBufferAsync(Jimp.MIME_JPEG);
      
      Logger.info('Image optimized for AI processing');
      return optimized;
      
    } catch (error) {
      Logger.error('Image optimization failed:', error);
      return imageBuffer; // Return original if optimization fails
    }
  }

  /**
   * Clean up temporary screenshot files
   */
  async cleanupTempFiles() {
    try {
      const files = await fs.readdir(this.outputPath);
      const imageFiles = files.filter(file => 
        file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png')
      );
      
      for (const file of imageFiles) {
        await fs.unlink(path.join(this.outputPath, file));
      }
      
      Logger.info(`Cleaned up ${imageFiles.length} screenshot files`);
    } catch (error) {
      Logger.warn('Failed to clean up screenshot files:', error.message);
    }
  }

  /**
   * Test screenshot functionality
   * @returns {Promise<boolean>} Test result
   */
  async testCapture() {
    try {
      const buffer = await this.captureScreen();
      const isValid = buffer && buffer.length > 0;
      
      Logger.info('Screenshot test result:', isValid);
      return isValid;
      
    } catch (error) {
      Logger.error('Screenshot test failed:', error);
      return false;
    }
  }
}

module.exports = ScreenCapturer;