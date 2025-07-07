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
let aiInputWindow = null;
let isVisible = true;
let isRecording = false;
let allWindowsHidden = false; // Track global hide state
let geminiClient = null;
let audioRecorder = null;
let screenCapturer = null;
let lastAudioToggle = 0;

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
    registerAudioToggleShortcut();
  });

  // Handle window closed
  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function registerAIHotkeys() {
  // Hotkey 1: Toggle overlay window visibility (Ctrl+Shift+H)
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

  // Hotkey 5: Global Hide/Show All Windows (Ctrl+\)
  const globalHideSuccess = globalShortcut.register('CommandOrControl+\\', () => {
    toggleAllWindows();
  });

  console.log('Hotkey registration results:');
  console.log('  Hide/Show Overlay (Ctrl+Shift+H):', hideSuccess);
  console.log('  Ask AI (Ctrl+Shift+A):', askSuccess);
  console.log('  Record Audio (Ctrl+Shift+R):', recordSuccess);
  console.log('  Screenshot (Ctrl+Shift+S):', screenshotSuccess);
  console.log('  Global Hide/Show (Ctrl+\\):', globalHideSuccess);
  
  if (hideSuccess && askSuccess && recordSuccess && screenshotSuccess && globalHideSuccess) {
    console.log('✅ All AI hotkeys registered successfully');
  } else {
    console.error('❌ Some hotkeys failed to register - may be conflicts with other apps');
  }
}

// Register global shortcut for audio toggle (Ctrl+Shift+Space)
function registerAudioToggleShortcut() {
  const shortcut = 'CommandOrControl+Shift+Space';
  const success = globalShortcut.register(shortcut, async () => {
    const now = Date.now();
    if (now - lastAudioToggle < 500) return; // 500ms debounce
    lastAudioToggle = now;

    if (audioRecorder && !isRecording) {
      console.log('🎵 Global Toggle-record: START');
      try {
        await audioRecorder.startRecording();
        isRecording = true;
        console.log('🎵 System audio recording started via global hotkey');
        
        // Notify chat interface of recording status
        if (aiInputWindow && aiInputWindow.webContents) {
          aiInputWindow.webContents.send('recording-status-changed', true);
        }
        
      } catch (err) {
        console.error('Global Toggle-record: Failed to start recording', err);
      }
    } else if (audioRecorder && isRecording) {
      console.log('🎵 Global Toggle-record: STOP');
      try {
        const audioFile = await audioRecorder.stopRecording();
        isRecording = false;
        console.log('Audio file saved:', audioFile);
        // --- Send audio directly to Gemini ---
        try {
          const fs = require('fs');
          const audioBuffer = fs.readFileSync(audioFile);
          // Use a detailed, technical, layman-friendly prompt for audio analysis
          const audioPrompt = `You are an expert technical assistant. You will receive audio files (such as system recordings, meeting audio, or technical discussions) that may contain technical jargon, programming terms, or IT-related questions. Your job is to:

1. Listen to the audio and interpret the content as accurately as possible, even if there are unclear words, background noise, or mispronunciations.
2. If you detect technical terms that are mispronounced or unclear, make your best guess as to what the user meant (e.g., "jandu" might mean "Django").
3. Always assume the audio is asking about a technical topic (software, hardware, programming, IT, etc.).
4. Provide your answer in clear, simple, informal, and layman-friendly language.
5. Be concise and to the point, but thorough enough to be helpful.
6. If you are unsure, explain your reasoning and give your best guess.

Examples:
- If the audio asks about "jandu", answer about Django (the Python web framework).
- If the audio asks "how to use dockers?", answer about Docker (the containerization tool).
- If the audio asks "what is githap?", answer about GitHub.

**Remember:**
- The audio is always technical in nature.
- Your job is to help the user as best as possible, even if the audio is unclear or contains errors.
- Use informal, friendly, and simple language.
- Be direct and helpful.`;
          const aiResponse = await geminiClient.processAudio(
            audioBuffer,
            'audio/wav',
            audioPrompt
          );
          console.log('Gemini AI audio response:', aiResponse);
        } catch (audioErr) {
          console.error('Gemini audio analysis failed:', audioErr);
        }
        // Optionally: clean up audio file
        try { await audioRecorder.cleanupAudioFile(audioFile); } catch {}
      } catch (err) {
        console.error('Global Toggle-record: Failed to stop recording', err);
        isRecording = false;
        
        // Notify chat interface recording stopped (error case)
        if (aiInputWindow && aiInputWindow.webContents) {
          aiInputWindow.webContents.send('recording-status-changed', false);
        }
      }
    }
  });
  if (success) {
    console.log('✅ Audio toggle shortcut registered:', shortcut);
  } else {
    console.error('❌ Failed to register audio toggle shortcut:', shortcut);
  }
}

// Function to toggle overlay window visibility
function toggleWindowVisibility() {
  if (!overlayWindow) return;

  if (isVisible) {
    overlayWindow.hide();
    isVisible = false;
    console.log('Overlay window hidden via hotkey');
  } else {
    overlayWindow.show();
    isVisible = true;
    console.log('Overlay window shown via hotkey');
  }
}

// Function to toggle ALL windows visibility
function toggleAllWindows() {
  console.log('🌐 Global hide/show hotkey pressed (Ctrl+\\)');
  
  if (allWindowsHidden) {
    // Show all windows
    if (overlayWindow) {
      overlayWindow.show();
      isVisible = true;
    }
    if (aiInputWindow) {
      aiInputWindow.show();
    }
    allWindowsHidden = false;
    console.log('👁️ All windows shown');
  } else {
    // Hide all windows
    if (overlayWindow) {
      overlayWindow.hide();
      isVisible = false;
    }
    if (aiInputWindow) {
      aiInputWindow.hide();
    }
    allWindowsHidden = true;
    console.log('🙈 All windows hidden');
  }
}

// AI Functions
async function showAITextInput() {
  if (!overlayWindow) return;
  
  console.log('🤖 AI Text Input hotkey pressed (Ctrl+Shift+A)');
  
  // If all windows are globally hidden, show them first
  if (allWindowsHidden) {
    toggleAllWindows();
  }
  
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
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  
  aiInputWindow = new BrowserWindow({
    width: 700,
    height: 500,
    x: Math.floor((width - 700) / 2), // Center horizontally
    y: Math.floor((height - 500) / 2), // Center vertically
    modal: false,
    parent: overlayWindow,
    show: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minWidth: 500,
    minHeight: 400,
    
    // CRITICAL: Same stealth protection as main overlay
    transparent: false,
    backgroundColor: '#0a0a0a',
    
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
  console.log('⚠️ Audio recording now handled in chat interface - use Ctrl+Shift+A to open chat and click audio button');
  
  // Show AI chat if not visible
  if (!aiInputWindow || !aiInputWindow.isVisible()) {
    showAITextInput();
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
    const wasOverlayVisible = isVisible;
    const wasAIVisible = aiInputWindow && aiInputWindow.isVisible();
    
    if (wasOverlayVisible) {
      overlayWindow.hide();
    }
    if (wasAIVisible) {
      aiInputWindow.hide();
    }
    
    // Wait a moment for windows to hide
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Capture screen
    const screenshot = await screenCapturer.captureScreen();
    
    // Restore window visibility
    if (wasOverlayVisible) {
      overlayWindow.show();
    }
    if (wasAIVisible) {
      aiInputWindow.show();
    }
    
    // Send to AI for analysis
    const aiResponse = await geminiClient.processImage(screenshot);
    
    // Show result in chat if available, otherwise in console
    if (aiInputWindow && aiInputWindow.isVisible()) {
      aiInputWindow.webContents.send('add-screenshot-result', {
        response: aiResponse,
        screenshot: screenshot.toString('base64')
      });
    } else {
      console.log('📸 Screenshot analysis:', aiResponse.substring(0, 100) + '...');
    }
    
  } catch (error) {
    console.log('❌ Screen capture failed:', error.message);
    
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

ipcMain.handle('take-screenshot-and-analyze', async (event) => {
  try {
    console.log('📸 Screenshot requested from chat interface');
    
    if (!screenCapturer || !geminiClient) {
      throw new Error('Screen capturer or Gemini client not initialized');
    }

    // Temporarily hide all windows to avoid capturing them
    const wasOverlayVisible = overlayWindow && overlayWindow.isVisible();
    const wasAIVisible = aiInputWindow && aiInputWindow.isVisible();
    
    if (wasOverlayVisible) {
      overlayWindow.hide();
    }
    if (wasAIVisible) {
      aiInputWindow.hide();
    }
    
    // Wait for windows to hide
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Capture screen
    const screenshot = await screenCapturer.captureScreen();
    
    // Restore window visibility
    if (wasOverlayVisible) {
      overlayWindow.show();
    }
    if (wasAIVisible) {
      aiInputWindow.show();
      aiInputWindow.focus();
    }
    
    // Send to AI for analysis
    const aiResponse = await geminiClient.processImage(screenshot, 'Analyze this screenshot and describe what you see. Focus on the main content, UI elements, and any text that might be relevant.');
    
    // Convert screenshot to base64 for display
    const screenshotBase64 = screenshot.toString('base64');
    
    return { 
      success: true, 
      response: aiResponse,
      screenshot: screenshotBase64
    };
    
  } catch (error) {
    console.error('Screenshot analysis failed:', error);
    
    // Restore windows on error
    if (overlayWindow && !overlayWindow.isVisible()) {
      overlayWindow.show();
    }
    if (aiInputWindow && !aiInputWindow.isVisible()) {
      aiInputWindow.show();
      aiInputWindow.focus();
    }
    
    return { success: false, error: error.message };
  }
});

// NEW: System audio recording IPC handlers
ipcMain.handle('start-system-audio-recording', async (event) => {
  try {
    console.log('🎵 System audio recording start requested from chat interface');
    
    if (!audioRecorder) {
      throw new Error('Audio recorder not initialized');
    }

    if (isRecording) {
      throw new Error('Recording already in progress');
    }

    const recordingFile = await audioRecorder.startRecording();
    isRecording = true;
    
    console.log('✅ System audio recording started:', recordingFile);
    return { success: true, message: 'System audio recording started via VB Cable' };
    
  } catch (error) {
    console.error('❌ Failed to start system audio recording:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-system-audio-recording', async (event) => {
  try {
    console.log('🛑 Stop system audio recording requested from chat interface');
    
    if (!audioRecorder) {
      throw new Error('Audio recorder not initialized');
    }

    if (!isRecording) {
      throw new Error('No recording in progress');
    }

    const audioFile = await audioRecorder.stopRecording();
    isRecording = false;
    
    console.log('✅ System audio file saved:', audioFile);
    
    // Process audio with Gemini
    try {
      console.log('Sending system audio directly to Gemini...');
      
      const fs = require('fs');
      const audioBuffer = fs.readFileSync(audioFile);
      
      const aiResponse = await geminiClient.processAudio(audioBuffer, 'audio/wav', 'Please listen to this system audio and provide a helpful response about what you heard.');
      
      console.log('✅ Gemini AI system audio response received');
      
      // Send result to chat interface
      if (event.sender) {
        event.sender.send('add-audio-result', {
          response: aiResponse,
          audioFile: audioFile
        });
      }
      
      // Clean up audio file
      await audioRecorder.cleanupAudioFile(audioFile);
      
      return { success: true, message: 'System audio processed successfully' };
      
    } catch (audioProcessErr) {
      console.error('❌ System audio processing failed:', audioProcessErr);
      
      // Send error to chat
      if (event.sender) {
        event.sender.send('add-audio-result', {
          response: `❌ Audio processing failed: ${audioProcessErr.message}`,
          audioFile: null
        });
      }
      
      return { success: false, error: audioProcessErr.message };
    }
    
  } catch (error) {
    console.error('❌ Failed to stop system audio recording:', error);
    isRecording = false;
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