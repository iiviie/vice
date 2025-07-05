// src/audio/recorder.js - System Audio Recording and Transcription
const recorder = require('node-record-lpcm16');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const Logger = require('../utils/logger');

class SystemAudioRecorder {
  constructor() {
    this.recording = null;
    this.isRecording = false;
    this.outputPath = path.join(__dirname, '../../temp');
    this.currentRecordingFile = null;
    
    // Ensure temp directory exists
    this.ensureTempDirectory();
    
    // Audio recorder options
    this.recorderOptions = {
      sampleRateHertz: parseInt(process.env.AUDIO_SAMPLE_RATE) || 16000,
      threshold: 0.5,
      verbose: false,
      recordProgram: 'sox', // Use SoX for cross-platform recording
      silence: '1.0'
    };
    
    Logger.info('Audio recorder initialized');
  }

  async ensureTempDirectory() {
    try {
      await fs.mkdir(this.outputPath, { recursive: true });
    } catch (error) {
      Logger.error('Failed to create temp directory:', error);
    }
  }

  /**
   * Start recording system audio
   * @returns {Promise<string>} Recording file path
   */
  async startRecording() {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    try {
      const timestamp = Date.now();
      this.currentRecordingFile = path.join(this.outputPath, `recording_${timestamp}.wav`);
      
      // Start recording
      this.recording = recorder.record(this.recorderOptions);
      
      // Pipe to file
      const fileStream = require('fs').createWriteStream(this.currentRecordingFile);
      this.recording.stream().pipe(fileStream);
      
      this.isRecording = true;
      Logger.info('Audio recording started:', this.currentRecordingFile);
      
      return this.currentRecordingFile;
      
    } catch (error) {
      Logger.error('Failed to start audio recording:', error);
      throw new Error(`Recording failed: ${error.message}`);
    }
  }

  /**
   * Stop recording system audio
   * @returns {Promise<string>} Path to recorded file
   */
  async stopRecording() {
    if (!this.isRecording || !this.recording) {
      throw new Error('No recording in progress');
    }

    try {
      this.recording.stop();
      this.isRecording = false;
      
      // Wait a moment for file to be written
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      Logger.info('Audio recording stopped:', this.currentRecordingFile);
      return this.currentRecordingFile;
      
    } catch (error) {
      Logger.error('Failed to stop audio recording:', error);
      throw new Error(`Stop recording failed: ${error.message}`);
    }
  }

  /**
   * Transcribe audio file to text using Whisper
   * @param {string} audioFilePath - Path to audio file
   * @returns {Promise<string>} Transcribed text
   */
  async transcribeAudio(audioFilePath) {
    try {
      Logger.info('Starting audio transcription:', audioFilePath);
      
      // Check if file exists
      await fs.access(audioFilePath);
      
      // Use OpenAI Whisper for transcription
      const transcription = await this.runWhisperTranscription(audioFilePath);
      
      // Clean up temporary file
      await this.cleanupAudioFile(audioFilePath);
      
      Logger.info('Audio transcription completed');
      return transcription;
      
    } catch (error) {
      Logger.error('Audio transcription failed:', error);
      
      // Fallback: return placeholder text if Whisper fails
      const fallbackText = "Audio transcription failed. Please ensure Whisper is installed: pip install openai-whisper";
      Logger.warn('Using fallback transcription text');
      return fallbackText;
    }
  }

  /**
   * Run Whisper transcription
   * @param {string} audioFilePath - Path to audio file
   * @returns {Promise<string>} Transcribed text
   */
  async runWhisperTranscription(audioFilePath) {
    return new Promise((resolve, reject) => {
      // Use whisper command line tool
      const whisper = spawn('whisper', [
        audioFilePath,
        '--model', 'base',
        '--output_format', 'txt',
        '--output_dir', this.outputPath,
        '--verbose', 'False'
      ]);

      let output = '';
      let error = '';

      whisper.stdout.on('data', (data) => {
        output += data.toString();
      });

      whisper.stderr.on('data', (data) => {
        error += data.toString();
      });

      whisper.on('close', async (code) => {
        if (code === 0) {
          try {
            // Read the generated transcript file
            const baseName = path.basename(audioFilePath, '.wav');
            const transcriptFile = path.join(this.outputPath, `${baseName}.txt`);
            const transcription = await fs.readFile(transcriptFile, 'utf8');
            
            // Clean up transcript file
            await fs.unlink(transcriptFile).catch(() => {});
            
            resolve(transcription.trim());
          } catch (readError) {
            reject(new Error(`Failed to read transcription: ${readError.message}`));
          }
        } else {
          reject(new Error(`Whisper failed with code ${code}: ${error}`));
        }
      });

      whisper.on('error', (err) => {
        reject(new Error(`Whisper process error: ${err.message}`));
      });
    });
  }

  /**
   * Alternative: Use Web Speech API via Electron (fallback)
   * @param {string} audioFilePath - Path to audio file
   * @returns {Promise<string>} Transcribed text
   */
  async transcribeWithWebSpeech(audioFilePath) {
    // This is a placeholder for Web Speech API integration
    // Would need to be implemented in the renderer process
    throw new Error('Web Speech API transcription requires renderer process implementation');
  }

  /**
   * Clean up temporary audio file
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
      currentFile: this.currentRecordingFile,
      outputPath: this.outputPath
    };
  }

  /**
   * Clean up all temporary files
   */
  async cleanupAllTempFiles() {
    try {
      const files = await fs.readdir(this.outputPath);
      const audioFiles = files.filter(file => 
        file.endsWith('.wav') || file.endsWith('.txt')
      );
      
      for (const file of audioFiles) {
        await fs.unlink(path.join(this.outputPath, file));
      }
      
      Logger.info(`Cleaned up ${audioFiles.length} temporary files`);
    } catch (error) {
      Logger.warn('Failed to clean up temp files:', error.message);
    }
  }

  /**
   * Test recording functionality
   * @returns {Promise<boolean>} Test result
   */
  async testRecording() {
    try {
      // Try to start a brief recording
      await this.startRecording();
      
      // Record for 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const filePath = await this.stopRecording();
      
      // Check if file exists and has content
      const stats = await fs.stat(filePath);
      const isValid = stats.size > 0;
      
      // Clean up test file
      await this.cleanupAudioFile(filePath);
      
      Logger.info('Recording test result:', isValid);
      return isValid;
      
    } catch (error) {
      Logger.error('Recording test failed:', error);
      return false;
    }
  }
}

module.exports = SystemAudioRecorder;