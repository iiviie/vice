# Stealth AI Overlay

An AI-powered stealth overlay application with screen capture protection, system audio recording, and multimodal AI integration using Google Gemini.

## 🚀 Features

- **Stealth Overlay**: Content protection prevents screen capture in recordings/streams
- **System Audio Recording**: Capture and analyze audio playing on your computer
- **Screenshot Analysis**: AI-powered screen capture and analysis
- **Chat Interface**: Clean chat UI for AI interactions
- **Global Hotkeys**: Quick access from anywhere
- **Multimodal AI**: Text, image, and audio processing with Google Gemini

## 📋 Prerequisites

### 1. Node.js and npm
Download and install from [nodejs.org](https://nodejs.org)

### 2. FFmpeg
**Windows:**
1. Download from [ffmpeg.org](https://ffmpeg.org/download.html)
2. Extract to `C:\ffmpeg`
3. Add `C:\ffmpeg\bin` to your PATH environment variable

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg
```

### 3. SoX (Sound Processing)
**Windows:**
1. Download from [sox.sourceforge.net](https://sox.sourceforge.net/)
2. Install to default location
3. Add SoX installation directory to PATH

**macOS:**
```bash
brew install sox
```

**Linux:**
```bash
sudo apt install sox
```

### 4. VB-Audio Virtual Cable
1. Download from [vb-audio.com](https://vb-audio.com/Cable/)
2. Install the Virtual Cable driver
3. **Restart your computer** after installation

### 5. Google Gemini API Key
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key for later use

## 🔧 Installation

### 1. Clone Repository
```bash
git clone <repository-url>
cd stealth-ai-overlay
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-pro-latest
OVERLAY_OPACITY=0.9
AUDIO_SAMPLE_RATE=16000
SCREENSHOT_FORMAT=jpeg
SCREENSHOT_QUALITY=0.8
LOG_LEVEL=info
```

## 🎵 VB-Audio Virtual Cable Setup

### Windows Sound Control Panel Configuration

#### Playback Tab Setup:
1. **Right-click on sound icon** in system tray → **"Open Sound settings"** → **"Sound Control Panel"**
2. **In Playback tab:**
   - Right-click **"CABLE Input (VB-Audio Virtual Cable)"**
   - Select **"Set as Default Device"**
   - Select **"Set as Default Communications Device"**
   - Right-click **"CABLE Input"** → **"Properties"**
   - Go to **"Listen"** tab
   - ✅ Check **"Listen to this device"**
   - Select your **Headphones/Speakers** in dropdown
   - Click **"Apply"** and **"OK"**

#### Recording Tab Setup:
1. **In Recording tab:**
   - Right-click **"CABLE Output (VB-Audio Virtual Cable)"**
   - Select **"Set as Default Device"**
   - Select **"Set as Default Communications Device"**

### Expected Configuration:
```
📢 PLAYBACK (Default): CABLE Input VB-Audio Virtual Cable
🎤 RECORDING (Default): CABLE Output VB-Audio Virtual Cable
🎧 LISTEN THROUGH: Your Headphones/Speakers
```

### Audio Flow:
```
System Audio → CABLE Input → CABLE Output → App Recording
     ↓
Your Headphones (for monitoring)
```

## ▶️ Running the Application

### Development Mode:
```bash
npm start
```

### Production Build:
```bash
npm run build
npm run dist
```

## 🎮 Usage

### Global Hotkeys:
- **Ctrl+Shift+H**: Hide/Show overlay
- **Ctrl+Shift+A**: Open/Close AI chat
- **Ctrl+Shift+S**: Take screenshot + AI analysis
- **Ctrl+Shift+Space**: Start/Stop system audio recording
- **Ctrl+\\**: Hide/Show ALL windows

### Chat Interface:
- **🎵 Audio Button**: Record system audio
- **📷 Screenshot Button**: Capture and analyze screen
- **Text Input**: Ask AI questions
- **🗑️ Clear**: Clear chat history
- **📤 Export**: Export chat as JSON

## 🔊 Discord/Google Meet Configuration

When using voice chat applications:

### Discord Settings:
1. **Discord Settings** → **Voice & Video**
2. **Input Device**: "External Microphone" (your real mic)
3. **Output Device**: "CABLE Input (VB-Audio Virtual Cable)"

### Google Meet Settings:
1. **Click Settings gear** in Google Meet
2. **Microphone**: "External Microphone"
3. **Speakers**: "CABLE Input (VB-Audio Virtual Cable)"

This allows you to:
- ✅ Talk using your real microphone
- ✅ Capture Discord/Meet audio with the app
- ✅ Hear everything through your headphones

## 🛠️ Troubleshooting

### "No handler registered" Error:
- Restart the application
- Check if all dependencies are installed

### Audio Recording Issues:
1. **Verify VB Cable Installation**:
   - Check if "CABLE Input/Output" appear in Sound settings
   - Restart computer if just installed

2. **Check SoX Installation**:
   ```bash
   sox --version
   ```

3. **Audio Configuration**:
   - Ensure CABLE Input is default playback device
   - Ensure CABLE Output is default recording device
   - Test by playing music - you should hear it in headphones

### Gemini API Errors:
- Verify API key in `.env` file
- Check internet connection
- Ensure API key has proper permissions

### Screen Capture Issues:
- Run as administrator (Windows)
- Check if other screen capture software is running
- Verify FFmpeg installation

## 📁 Project Structure

```
stealth-ai-overlay/
├── main.js                 # Main Electron process
├── overlay.html            # Overlay window UI
├── test-modal.html         # Chat interface UI
├── package.json            # Dependencies and scripts
├── .env                    # Environment variables
├── src/
│   ├── ai/
│   │   └── gemini.js       # Gemini AI client
│   ├── audio/
│   │   └── recorder.js     # Audio recording module
│   ├── screen/
│   │   └── capturer.js     # Screen capture module
│   └── utils/
│       └── logger.js       # Logging utility
├── temp/                   # Temporary files (auto-created)
└── logs/                   # Application logs (auto-created)
```

## 🔒 Security Features

- **Content Protection**: Prevents screen capture of overlay windows
- **Stealth Mode**: No persistent chat history
- **Temporary Files**: Audio recordings automatically deleted
- **No External Dependencies**: All processing done locally + Gemini API

## 🆘 Support

### Common Issues:

1. **"Recording already in progress"**:
   - Wait for current recording to finish
   - Restart application if stuck

2. **"No audio captured"**:
   - Check VB Cable configuration
   - Ensure system audio is playing
   - Verify default audio devices

3. **"API key error"**:
   - Check `.env` file format
   - Regenerate API key if needed

### Testing Your Setup:

1. **Audio Test**:
   - Play music on your computer
   - You should hear it in your headphones
   - Press Ctrl+Shift+Space to record
   - AI should describe the music

2. **Screenshot Test**:
   - Press Ctrl+Shift+S
   - AI should describe what's on your screen

3. **Chat Test**:
   - Press Ctrl+Shift+A
   - Type a message and press Enter
   - AI should respond

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

---

**⚠️ Important**: This application captures system audio and screenshots. Use responsibly and in compliance with local laws and regulations.