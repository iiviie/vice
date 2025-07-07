// src/audio/recorder.js - System Audio Recording and Transcription
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
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
      silence: '1.0',
      device: 'CABLE Output (VB-Audio Virtual Cable)'
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
      
      // Use the exact working command
      this.recording = spawn('sox', [
        '-t', 'waveaudio',
        'CABLE Output (VB-Audio Virtual Cable)',
        this.currentRecordingFile
      ]);
      
      this.isRecording = true;
      Logger.info('Audio recording started:', this.currentRecordingFile);
      
      this.recording.stderr.on('data', (data) => {
        Logger.error('SoX STDERR:', data.toString());
      });

      this.recording.on('close', (code) => {
        Logger.info('SoX process exited with code', code);
      });
      
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
      this.recording.kill('SIGINT'); // Send Ctrl+C to stop sox
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
      // Use whisper command line tool with base model, output to stdout
      const whisper = spawn('whisper', [
        audioFilePath,
        '--model', 'base',
        '--output_format', 'json', // We'll read and delete the file immediately
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
            // Read the generated transcript file (json)
            const baseName = path.basename(audioFilePath, '.wav');
            const transcriptFile = path.join(this.outputPath, `${baseName}.json`);
            let transcription = '';
            try {
              const jsonContent = await fs.readFile(transcriptFile, 'utf8');
              const json = JSON.parse(jsonContent);
              transcription = json.text || '';
            } catch (e) {
              transcription = '';
            }
            // Clean up transcript file
            await fs.unlink(transcriptFile).catch(() => {});
            // Clean up .txt file if it exists
            const txtFile = path.join(this.outputPath, `${baseName}.txt`);
            await fs.unlink(txtFile).catch(() => {});
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