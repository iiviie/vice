// main.js - Main process for AI-powered stealth overlay
const { app, BrowserWindow, screen, globalShortcut, ipcMain, dialog } = require('electron');
const path = require('path');
require('dotenv').config();

// Import AI modules
const GeminiClient = require('./src/ai/gemini');
const AudioRecorder = require('./src/audio/recorder');
const ScreenCapturer = require('./src/screen/capturer');
const Logger = require('./src/utils/logger');

let overlayWindow = null;
let aiInputWindow = null; // Track the AI input window
let isVisible = true;
let isRecording = false;
let geminiClient = null;
let audioRecorder = null;
let screenCapturer = null;

// Initialize AI client
async function initializeAI() {
  try {
    geminiClient = new GeminiClient(process.env.GEMINI_API_KEY);
    audioRecorder = new AudioRecorder();
    screenCapturer = new ScreenCapturer();
    
    Logger.info('AI modules initialized successfully');
    console.log('✅ AI modules initialized successfully');
    return true;
  } catch (error) {
    Logger.error('Failed to initialize AI modules:', error);
    console.log('❌ Failed to initialize AI modules:', error.message);
    
    // Show error dialog
    dialog.showErrorBox(
      'AI Initialization Failed',
      'Failed to initialize AI modules. Please check your API key in .env file.'
    );
    return false;
  }
}

function createOverlay() {
  // Get primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  
  // Create the overlay window
  overlayWindow = new BrowserWindow({
    width: 400,
    height: 50,
    x: Math.floor((width - 400) / 2), // Center horizontally
    y: 10, // Top of screen
    
    // Window properties for overlay behavior
    frame: false,           // Frameless window
    alwaysOnTop: true,      // Always stay on top
    skipTaskbar: true,      // Don't show in taskbar
    resizable: false,       // Fixed size
    movable: true,          // Allow dragging
    
    // CRITICAL: Use opaque background - transparent windows break content protection
    transparent: false,     // Must be false for content protection to work
    backgroundColor: '#1a1a1a', // Dark opaque background
    opacity: parseFloat(process.env.OVERLAY_OPACITY) || 0.9,
    
    // Window behavior
    focusable: true,        // Can receive focus
    show: false,            // Don't show immediately
    
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      enableRemoteModule: true
    }
  });

  // Load the HTML content
  overlayWindow.loadFile('overlay.html');

  // Optional: Open DevTools for debugging (comment out for production)
  // overlayWindow.webContents.openDevTools({ mode: 'detach' });

  // CRITICAL: Apply content protection AFTER window is ready
  overlayWindow.once('ready-to-show', () => {
    console.log('Window ready, applying content protection...');
    
    // Show the window first
    overlayWindow.show();
    
    // Apply content protection - this calls SetWindowDisplayAffinity internally
    const success = overlayWindow.setContentProtection(true);
    console.log('Content protection enabled:', success);
    
    // Initialize AI modules
    initializeAI();
    
    // Register all hotkeys AFTER window is ready
    registerAIHotkeys();
  });

  // Handle window closed
  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function registerAIHotkeys() {
  // Hotkey 1: Toggle window visibility (Ctrl+Shift+H)
  const hideSuccess = globalShortcut.register('CommandOrControl+Shift+H', () => {
    toggleWindowVisibility();
  });

  // Hotkey 2: AI Text Query (Ctrl+Shift+A)
  const askSuccess = globalShortcut.register('CommandOrControl+Shift+A', () => {
    showAITextInput();
  });

  // Hotkey 3: Audio Recording + Transcription (Ctrl+Shift+R)
  const recordSuccess = globalShortcut.register('CommandOrControl+Shift+R', () => {
    toggleAudioRecording();
  });

  // Hotkey 4: Screenshot + AI Analysis (Ctrl+Shift+S)
  const screenshotSuccess = globalShortcut.register('CommandOrControl+Shift+S', () => {
    captureAndAnalyzeScreen();
  });

  console.log('Hotkey registration results:');
  console.log('  Hide/Show (Ctrl+Shift+H):', hideSuccess);
  console.log('  Ask AI (Ctrl+Shift+A):', askSuccess);
  console.log('  Record Audio (Ctrl+Shift+R):', recordSuccess);
  console.log('  Screenshot (Ctrl+Shift+S):', screenshotSuccess);
  
  if (hideSuccess && askSuccess && recordSuccess && screenshotSuccess) {
    console.log('✅ All AI hotkeys registered successfully');
  } else {
    console.error('❌ Some hotkeys failed to register - may be conflicts with other apps');
  }
}

// Function to toggle window visibility
function toggleWindowVisibility() {
  if (!overlayWindow) return;

  if (isVisible) {
    overlayWindow.hide();
    isVisible = false;
    console.log('Window hidden via hotkey');
  } else {
    overlayWindow.show();
    isVisible = true;
    console.log('Window shown via hotkey');
  }
}

// AI Functions
async function showAITextInput() {
  if (!overlayWindow) return;
  
  console.log('🤖 AI Text Input hotkey pressed (Ctrl+Shift+A)');
  
  // If AI window already exists, toggle it instead of creating new one
  if (aiInputWindow) {
    if (aiInputWindow.isVisible()) {
      aiInputWindow.hide();
      console.log('AI input window hidden');
    } else {
      aiInputWindow.show();
      aiInputWindow.focus();
      console.log('AI input window shown');
    }
    return;
  }
  
  // Create a new stealth-protected window for AI input
  aiInputWindow = new BrowserWindow({
    width: 600,
    height: 400,
    modal: false,
    parent: overlayWindow,
    show: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    
    // CRITICAL: Same stealth protection as main overlay
    transparent: false,
    backgroundColor: '#1a1a1a',
    
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });
  
  aiInputWindow.loadFile('test-modal.html');
  
  aiInputWindow.once('ready-to-show', () => {
    // CRITICAL: Apply content protection to AI modal too
    const success = aiInputWindow.setContentProtection(true);
    console.log('AI modal content protection enabled:', success);
    
    aiInputWindow.show();
    aiInputWindow.focus();
  });
  
  // Handle AI window closed
  aiInputWindow.on('closed', () => {
    aiInputWindow = null;
    console.log('AI input window closed');
  });
}

async function toggleAudioRecording() {
  console.log('🎵 Audio Recording hotkey pressed (Ctrl+Shift+R)');
  
  if (!audioRecorder) {
    console.log('❌ Audio recorder not initialized');
    return;
  }

  if (isRecording) {
    console.log('Stopping audio recording...');
    try {
      const audioFile = await audioRecorder.stopRecording();
      const transcription = await audioRecorder.transcribeAudio(audioFile);
      
      // Send transcription to AI
      const aiResponse = await geminiClient.processText(transcription);
      
      // Show result in overlay
      overlayWindow.webContents.send('show-ai-response', {
        type: 'audio',
        input: transcription,
        response: aiResponse
      });
      
      isRecording = false;
      overlayWindow.webContents.send('update-recording-status', false);
      
    } catch (error) {
      console.log('❌ Audio recording failed:', error.message);
      overlayWindow.webContents.send('show-error', 'Audio recording failed: ' + error.message);
    }
  } else {
    console.log('Starting audio recording...');
    try {
      await audioRecorder.startRecording();
      isRecording = true;
      overlayWindow.webContents.send('update-recording-status', true);
    } catch (error) {
      console.log('❌ Failed to start recording:', error.message);
      overlayWindow.webContents.send('show-error', 'Failed to start recording: ' + error.message);
    }
  }
}

async function captureAndAnalyzeScreen() {
  console.log('📸 Screenshot hotkey pressed (Ctrl+Shift+S)');
  
  if (!screenCapturer || !geminiClient) {
    console.log('❌ Screen capturer or Gemini client not initialized');
    return;
  }

  console.log('Capturing screen for AI analysis...');
  
  try {
    // Temporarily hide overlay to avoid capturing itself
    const wasVisible = isVisible;
    if (wasVisible) {
      overlayWindow.hide();
    }
    
    // Wait a moment for window to hide
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Capture screen
    const screenshot = await screenCapturer.captureScreen();
    
    // Restore overlay visibility
    if (wasVisible) {
      overlayWindow.show();
    }
    
    // Send to AI for analysis
    const aiResponse = await geminiClient.processImage(screenshot);
    
    // Show result in overlay
    overlayWindow.webContents.send('show-ai-response', {
      type: 'image',
      input: 'Screenshot captured',
      response: aiResponse,
      image: screenshot
    });
    
  } catch (error) {
    console.log('❌ Screen capture failed:', error.message);
    overlayWindow.webContents.send('show-error', 'Screen capture failed: ' + error.message);
    
    // Restore overlay visibility on error
    if (overlayWindow && !isVisible) {
      overlayWindow.show();
    }
  }
}

// IPC handlers for renderer process communication
ipcMain.handle('process-ai-text', async (event, text) => {
  try {
    const response = await geminiClient.processText(text);
    return { success: true, response };
  } catch (error) {
    console.error('AI text processing failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-ai-status', () => {
  return {
    geminiConnected: !!geminiClient,
    audioReady: !!audioRecorder,
    screenReady: !!screenCapturer,
    recording: isRecording
  };
});

// App event handlers
app.whenReady().then(() => {
  console.log('App ready, creating overlay...');
  createOverlay();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (overlayWindow === null) {
    createOverlay();
  }
});

// Handle app quit
app.on('before-quit', () => {
  console.log('App quitting...');
  
  // Stop recording if active
  if (isRecording && audioRecorder) {
    audioRecorder.stopRecording().catch(err => console.log('Error stopping recording:', err));
  }
  
  // Unregister all global shortcuts
  globalShortcut.unregisterAll();
});

app.on('will-quit', () => {
  // Unregister all global shortcuts
  globalShortcut.unregisterAll();
});

// Export for potential use
module.exports = { overlayWindow };