// main.js - Main process for stealth overlay
const { app, BrowserWindow, screen, globalShortcut, ipcMain } = require('electron');
const path = require('path');

let overlayWindow = null;
let isVisible = true;

function createOverlay() {
  // Get primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  
  // Create the overlay window
  overlayWindow = new BrowserWindow({
    width: 800,
    height: 60,
    x: Math.floor((width - 800) / 2), // Center horizontally
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
    opacity: 0.9,           // Semi-transparent overlay (this is safe)
    
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

  // Register global hotkey to toggle visibility (Ctrl+Shift+H)
  const toggleHotkey = 'CommandOrControl+Shift+H';
  const success = globalShortcut.register(toggleHotkey, () => {
    toggleWindowVisibility();
  });

  if (success) {
    console.log(`Global hotkey registered: ${toggleHotkey}`);
  } else {
    console.log('Failed to register global hotkey');
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

// IPC handlers for renderer process communication
ipcMain.handle('minimize-window', () => {
  if (overlayWindow) {
    overlayWindow.minimize();
  }
});

ipcMain.handle('close-window', () => {
  if (overlayWindow) {
    overlayWindow.close();
  }
});

ipcMain.handle('toggle-always-on-top', () => {
  if (overlayWindow) {
    const isAlwaysOnTop = overlayWindow.isAlwaysOnTop();
    overlayWindow.setAlwaysOnTop(!isAlwaysOnTop);
    return !isAlwaysOnTop;
  }
  return false;
});

ipcMain.handle('set-opacity', (event, opacity) => {
  if (overlayWindow) {
    overlayWindow.setOpacity(opacity);
    return true;
  }
  return false;
});

ipcMain.handle('get-native-handle', () => {
  if (overlayWindow) {
    try {
      const handleBuffer = overlayWindow.getNativeWindowHandle();
      const hwnd = handleBuffer.readInt32LE(0);
      return hwnd.toString(16);
    } catch (error) {
      console.error('Could not get native handle:', error);
      return null;
    }
  }
  return null;
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
  // Unregister all global shortcuts
  globalShortcut.unregisterAll();
});

app.on('will-quit', () => {
  // Unregister all global shortcuts
  globalShortcut.unregisterAll();
});

// Export for potential use
module.exports = { overlayWindow };