// src/audio/simple-recorder.js - Simple Web Audio Recorder for Gemini
const fs = require('fs').promises;
const path = require('path');
const Logger = require('../utils/logger');

class SimpleAudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.isRecording = false;
    this.outputPath = path.join(__dirname, '../../temp');
    this.currentRecordingFile = null;
    this.audioChunks = [];
    
    // Ensure temp directory exists
    this.ensureTempDirectory();
    
    Logger.info('Simple audio recorder initialized');
  }

  async ensureTempDirectory() {
    try {
      await fs.mkdir(this.outputPath, { recursive: true });
    } catch (error) {
      Logger.error('Failed to create temp directory:', error);
    }
  }

  /**
   * Start recording using Web Audio API
   * @returns {Promise<string>} Recording session ID
   */
  async startRecording() {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    try {
      Logger.info('Starting web audio recording...');
      
      // This will be handled in the renderer process
      // Just return a session indicator
      const sessionId = `session_${Date.now()}`;
      this.isRecording = true;
      
      Logger.info('Audio recording session started:', sessionId);
      return sessionId;
      
    } catch (error) {
      Logger.error('Failed to start audio recording:', error);
      this.isRecording = false;
      throw new Error(`Recording failed: ${error.message}`);
    }
  }

  /**
   * Stop recording
   * @returns {Promise<string>} Success message
   */
  async stopRecording() {
    if (!this.isRecording) {
      throw new Error('No recording in progress');
    }

    try {
      Logger.info('Stopping audio recording...');
      this.isRecording = false;
      
      Logger.info('Audio recording stopped');
      return 'Recording stopped - processing in renderer';
      
    } catch (error) {
      Logger.error('Failed to stop audio recording:', error);
      this.isRecording = false;
      throw new Error(`Stop recording failed: ${error.message}`);
    }
  }

  /**
   * Save audio blob to file (called from renderer)
   * @param {Buffer} audioBuffer - Audio data from renderer
   * @returns {Promise<string>} File path
   */
  async saveAudioFile(audioBuffer) {
    try {
      const timestamp = Date.now();
      const filePath = path.join(this.outputPath, `recording_${timestamp}.webm`);
      
      await fs.writeFile(filePath, audioBuffer);
      
      Logger.info('Audio file saved:', filePath);
      return filePath;
      
    } catch (error) {
      Logger.error('Failed to save audio file:', error);
      throw new Error(`Save audio failed: ${error.message}`);
    }
  }

  /**
   * Clean up audio file
   * @param {string} filePath - Path to file to clean up
   */
  async cleanupAudioFile(filePath) {
    try {
      await fs.unlink(filePath);
      Logger.info('Cleaned up audio file:', filePath);
    } catch (error) {
      Logger.warn('Failed to clean up audio file:', error.message);
    }
  }

  /**
   * Get current recording status
   * @returns {Object} Recording status
   */
  getStatus() {
    return {
      isRecording: this.isRecording,
      outputPath: this.outputPath
    };
  }

  /**
   * Test recording functionality
   * @returns {Promise<boolean>} Test result
   */
  async testRecording() {
    try {
      Logger.info('Testing simple recording functionality...');
      
      // Simple test - just check if we can start/stop
      await this.startRecording();
      await new Promise(resolve => setTimeout(resolve, 100));
      await this.stopRecording();
      
      Logger.info('Recording test passed');
      return true;
      
    } catch (error) {
      Logger.error('Recording test failed:', error);
      return false;
    }
  }
}

module.exports = SimpleAudioRecorder;