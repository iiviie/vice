# Stealth AI Overlay

AI-powered stealth overlay with screen capture protection and multimodal AI integration.

## Overview

**Stealth AI Overlay** is an Electron-based desktop application that provides a secure, always-on-top overlay for interacting with advanced AI models (Google Gemini), performing screen capture analysis, audio transcription, and more. The overlay is designed for privacy and security, using content protection to prevent screen capture by other apps.

## Features

- **Stealth Overlay:** Always-on-top, protected overlay window for secure AI interaction.
- **AI Integration:** Uses Google Gemini for text, image, and multimodal queries.
- **Screen Capture & Analysis:** Capture screenshots and analyze them with AI.
- **Audio Recording & Transcription:** Record system audio and transcribe using OpenAI Whisper.
- **Hotkey Controls:** Global hotkeys for quick access to all features.
- **Secure Logging:** Winston-based logging with file and console output.
- **Multimodal Chat UI:** Modern chat interface for text, audio, and screenshot queries.

## Installation

1. **Clone the repository:**
   ```sh
   git clone <repo-url>
   cd stealth-ai-overlay
   ```
2. **Install dependencies:**
   ```sh
   npm install
   ```
3. **Set up environment variables:**
   - Create a `.env` file in the root directory with the following variables:
     ```env
     GEMINI_API_KEY=your_google_gemini_api_key
     OVERLAY_OPACITY=0.9
     AUDIO_SAMPLE_RATE=16000
     SCREENSHOT_FORMAT=jpeg
     SCREENSHOT_QUALITY=0.8
     LOG_LEVEL=info
     ```
   - (Optional) Install [OpenAI Whisper](https://github.com/openai/whisper) for audio transcription:
     ```sh
     pip install openai-whisper
     ```
4. **Run the app:**
   ```sh
   npm start
   ```

## Usage

- The overlay window appears at the top of your screen.
- Use global hotkeys to interact with AI, record audio, or capture the screen.
- All AI responses and actions are shown in the overlay or chat modal.

## Hotkeys

| Hotkey                        | Action                                 |
|-------------------------------|----------------------------------------|
| Ctrl+Shift+H                  | Toggle overlay window visibility       |
| Ctrl+Shift+A                  | Open AI text input chat                |
| Ctrl+Shift+R                  | Start/stop audio recording & transcribe|
| Ctrl+Shift+S                  | Capture screenshot & analyze with AI   |
| Ctrl+\                        | Hide/show all overlay windows          |

## Project Structure

```
├── main.js              # Electron main process, hotkey logic, window management
├── overlay.html         # Overlay UI (bar at top of screen)
├── test-modal.html      # Chat/modal UI for AI interaction
├── src/
│   ├── ai/
│   │   └── gemini.js    # Google Gemini AI client (text, image, multimodal)
│   ├── audio/
│   │   └── recorder.js  # System audio recording & Whisper transcription
│   ├── screen/
│   │   └── capturer.js  # Screen capture, region/window capture, optimization
│   └── utils/
│       └── logger.js    # Winston logger configuration
├── logs/                # Log files (created at runtime)
├── temp/                # Temporary files (audio, screenshots)
├── package.json         # Project metadata and scripts
```

## Module Descriptions

### main.js
- Sets up the Electron app, overlay, and chat windows.
- Registers global hotkeys for all features.
- Handles IPC between renderer and main process.
- Manages AI, audio, and screen modules.

### src/ai/gemini.js
- Integrates Google Gemini for text, image, and multimodal AI queries.
- Handles API errors, rate limits, and prompt formatting.

### src/audio/recorder.js
- Records system audio using SoX and node-record-lpcm16.
- Transcribes audio using OpenAI Whisper (CLI required).
- Cleans up temporary files after transcription.

### src/screen/capturer.js
- Captures full screen, regions, or (future) windows.
- Optimizes screenshots for AI (resize, compress).
- Supports multi-display capture.

### src/utils/logger.js
- Configures Winston logger for console and file logging.
- Handles uncaught exceptions and promise rejections.

### overlay.html
- Modern, minimal overlay UI with status, hotkey hints, and notifications.
- Shows AI responses and recording status.

### test-modal.html
- Full-featured chat/modal UI for text, screenshot, and audio queries.
- Displays AI responses and screenshots inline.

## Logging

- Logs are written to the `logs/` directory (app.log, error.log, exceptions.log, rejections.log).
- Log level can be set via the `LOG_LEVEL` environment variable.

## Troubleshooting

- **Gemini API Key:**
  - Ensure your `.env` file contains a valid `GEMINI_API_KEY`.
  - Check your quota and billing at [Google MakerSuite](https://makersuite.google.com/app/apikey).
- **Audio Transcription:**
  - Requires [OpenAI Whisper](https://github.com/openai/whisper) installed and available in your PATH.
  - If transcription fails, check the logs and ensure Whisper is installed.
- **Screen Capture:**
  - Overlay uses content protection; screenshots will not capture the overlay itself.

## License

MIT

## Author

Your Name 