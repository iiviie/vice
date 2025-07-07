// src/ai/gemini.js - Gemini AI Client
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const Logger = require('../utils/logger');
const path = require('path');

// Load detailed technical prompt from file
let DETAILED_PROMPT = '';
(async () => {
  try {
    DETAILED_PROMPT = await fs.readFile(path.join(__dirname, 'prompt.txt'), 'utf8');
    Logger.info('Loaded Gemini prompt from prompt.txt');
  } catch (e) {
    Logger.warn('Could not load prompt.txt for Gemini:', e.message);
    DETAILED_PROMPT = '';
  }
})();

// Load audio analysis prompt from file
let AUDIO_ANALYSIS_PROMPT = '';
(async () => {
  try {
    AUDIO_ANALYSIS_PROMPT = await fs.readFile(path.join(__dirname, 'audio_analysis_prompt.txt'), 'utf8');
    Logger.info('Loaded Gemini audio analysis prompt from audio_analysis_prompt.txt');
  } catch (e) {
    Logger.warn('Could not load audio_analysis_prompt.txt for Gemini:', e.message);
    AUDIO_ANALYSIS_PROMPT = '';
  }
})();

class GeminiClient {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: process.env.GEMINI_MODEL || 'gemini-1.5-pro-latest' 
    });
    
    Logger.info('Gemini client initialized');
  }

  /**
   * Process text input with AI
   * @param {string} text - Input text to process
   * @param {string} context - Optional context for the query
   * @returns {Promise<string>} AI response
   */
  async processText(text, context = '') {
    try {
      Logger.info('Processing text with Gemini:', text.substring(0, 100) + '...');
      
      const promptContext = DETAILED_PROMPT + (context ? ('\n' + context) : '');
      const prompt = this.buildTextPrompt(text, promptContext);
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const responseText = response.text();
      
      Logger.info('Gemini text response received');
      return responseText;
      
    } catch (error) {
      Logger.error('Gemini text processing error:', error);
      
      // Handle specific error types
      if (error.message.includes('429') || error.message.includes('quota')) {
        return "⚠️ API Quota Exceeded\n\nYou've reached your Gemini API limit. Try:\n1. Wait a few minutes and try again\n2. Check your billing at https://makersuite.google.com\n3. Use a different API key\n\nError: Rate limit exceeded";
      } else if (error.message.includes('401') || error.message.includes('API key')) {
        return "🔑 API Key Error\n\nYour Gemini API key seems invalid. Please:\n1. Check your .env file\n2. Get a new key from https://makersuite.google.com/app/apikey\n3. Make sure the key is correctly set";
      } else {
        return `❌ AI Error\n\nSomething went wrong: ${error.message}\n\nPlease try again or check your internet connection.`;
      }
    }
  }

  /**
   * Process image with AI
   * @param {string|Buffer} imagePath - Path to image file or buffer
   * @param {string} prompt - Optional prompt for image analysis
   * @returns {Promise<string>} AI response
   */
  async processImage(imagePath, prompt = '') {
    try {
      Logger.info('Processing image with Gemini');
      
      let imageData;
      if (Buffer.isBuffer(imagePath)) {
        imageData = imagePath;
      } else {
        imageData = await fs.readFile(imagePath);
      }

      const imagePart = {
        inlineData: {
          data: imageData.toString('base64'),
          mimeType: 'image/jpeg'
        }
      };

      const textPrompt = this.buildImagePrompt(DETAILED_PROMPT + (prompt ? ('\n' + prompt) : ''));
      
      const result = await this.model.generateContent([textPrompt, imagePart]);
      const response = result.response;
      const responseText = response.text();
      
      Logger.info('Gemini image response received');
      return responseText;
      
    } catch (error) {
      Logger.error('Gemini image processing error:', error);
      throw new Error(`AI image processing failed: ${error.message}`);
    }
  }

  /**
   * Process multimodal input (text + image)
   * @param {string} text - Text input
   * @param {string|Buffer} imagePath - Image file path or buffer
   * @returns {Promise<string>} AI response
   */
  async processMultimodal(text, imagePath) {
    try {
      Logger.info('Processing multimodal input with Gemini');
      
      let imageData;
      if (Buffer.isBuffer(imagePath)) {
        imageData = imagePath;
      } else {
        imageData = await fs.readFile(imagePath);
      }

      const imagePart = {
        inlineData: {
          data: imageData.toString('base64'),
          mimeType: 'image/jpeg'
        }
      };

      const textPrompt = this.buildMultimodalPrompt(DETAILED_PROMPT + (text ? ('\n' + text) : ''));
      
      const result = await this.model.generateContent([textPrompt, imagePart]);
      const response = result.response;
      const responseText = response.text();
      
      Logger.info('Gemini multimodal response received');
      return responseText;
      
    } catch (error) {
      Logger.error('Gemini multimodal processing error:', error);
      throw new Error(`AI multimodal processing failed: ${error.message}`);
    }
  }

  /**
   * Process audio file with Gemini (if supported)
   * @param {Buffer} audioBuffer - Buffer of audio file (e.g., wav)
   * @param {string} mimeType - e.g., 'audio/wav'
   * @param {string} prompt - Optional prompt for audio analysis
   * @returns {Promise<string>} AI response
   */
  async processAudio(audioBuffer, mimeType = 'audio/wav', prompt = '') {
    try {
      Logger.info('Processing audio with Gemini');
      if (!this.model.generateContent) {
        throw new Error('Gemini API does not support audio input in this version.');
      }
      const audioPart = {
        inlineData: {
          data: audioBuffer.toString('base64'),
          mimeType: mimeType
        }
      };
      const textPrompt = (AUDIO_ANALYSIS_PROMPT || 'Please analyze the following audio and provide a helpful, technical, and layman-friendly response.') + (prompt ? ('\n' + prompt) : '');
      // Try sending audio as a part (if supported by the API)
      const result = await this.model.generateContent([textPrompt, audioPart]);
      const response = result.response;
      const responseText = response.text();
      Logger.info('Gemini audio response received');
      return responseText;
    } catch (error) {
      Logger.error('Gemini audio processing error:', error);
      throw new Error(`AI audio processing failed: ${error.message}`);
    }
  }

  /**
   * Build text prompt with context
   * @param {string} text - User input text
   * @param {string} context - Additional context
   * @returns {string} Formatted prompt
   */
  buildTextPrompt(text, context = '') {
    const basePrompt = `You are a helpful AI assistant integrated into a stealth overlay application. 
Provide concise, accurate, and helpful responses to user queries.

${context ? `Context: ${context}\n` : ''}

User Query: ${text}

Please provide a clear and helpful response:`;

    return basePrompt;
  }

  /**
   * Build image analysis prompt
   * @param {string} customPrompt - Custom prompt for image analysis
   * @returns {string} Formatted prompt
   */
  buildImagePrompt(customPrompt = '') {
    if (customPrompt) {
      return `Analyze this screenshot and ${customPrompt}. Provide a detailed but concise response.`;
    }
    
    return `Please analyze this screenshot and describe what you see. Focus on:
1. Main content and purpose of the screen
2. Any notable UI elements or applications visible
3. Text content that might be relevant
4. Suggested actions or insights based on what's shown

Provide a clear and organized response.`;
  }

  /**
   * Build multimodal prompt
   * @param {string} text - User text input
   * @returns {string} Formatted prompt
   */
  buildMultimodalPrompt(text) {
    return `User request: ${text}

Please analyze the provided image in the context of this request and provide a helpful response.`;
  }

  /**
   * Test API connection
   * @returns {Promise<boolean>} Connection status
   */
  async testConnection() {
    try {
      const result = await this.model.generateContent('Hello, please respond with "Connection successful"');
      const response = result.response.text();
      
      Logger.info('Gemini connection test result:', response);
      return response.toLowerCase().includes('connection successful');
      
    } catch (error) {
      Logger.error('Gemini connection test failed:', error);
      return false;
    }
  }
}

module.exports = GeminiClient;