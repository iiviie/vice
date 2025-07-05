// main.js - Main process for stealth overlay
const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

let overlayWindow = null;

function createOverlay() {
  // Get primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  
  // Create the overlay window
  overlayWindow = new BrowserWindow({
    width: 300,
    height: 200,
    x: width - 320, // Position near top-right
    y: 20,
    
    // Window properties for overlay behavior
    frame: false,           // Frameless window
    alwaysOnTop: true,      // Always stay on top
    skipTaskbar: true,      // Don't show in taskbar
    resizable: false,       // Fixed size
    movable: true,          // Allow dragging
    
    // CRITICAL: Use opaque background - transparent windows break content protection
    transparent: false,     // Must be false for content protection to work
    backgroundColor: '#1e1e1e', // Dark opaque background
    
    // Window behavior
    focusable: true,        // Can receive focus
    show: false,            // Don't show immediately
    
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  // Load the HTML content
  overlayWindow.loadFile('overlay.html');

  // CRITICAL: Apply content protection AFTER window is ready
  overlayWindow.once('ready-to-show', () => {
    console.log('Window ready, applying content protection...');
    
    // Show the window first
    overlayWindow.show();
    
    // Apply content protection - this calls SetWindowDisplayAffinity internally
    const success = overlayWindow.setContentProtection(true);
    console.log('Content protection enabled:', success);
    
    // Optional: Get the native handle for additional protection if needed
    try {
      const handleBuffer = overlayWindow.getNativeWindowHandle();
      const hwnd = handleBuffer.readInt32LE(0);
      console.log('Native window handle (HWND):', hwnd.toString(16));
    } catch (error) {
      console.error('Could not get native handle:', error);
    }
  });

  // Handle window closed
  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  // Optional: Handle window focus events
  overlayWindow.on('focus', () => {
    console.log('Overlay focused');
  });

  overlayWindow.on('blur', () => {
    console.log('Overlay blurred');
  });
}

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
});

// Export for potential use
module.exports = { overlayWindow };