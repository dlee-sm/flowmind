# FlowMind

Transform spoken workflows into visual diagrams using AI. FlowMind listens to your voice, transcribes on-device, and generates flowcharts, swimlane diagrams, and mind maps automatically.

## Features

- **Voice-to-Diagram** - Speak naturally about your workflow and watch it become a visual diagram
- **On-Device Transcription** - Uses Whisper AI locally for privacy and speed
- **Multiple Diagram Types** - Flowcharts, swimlane diagrams, mind maps, and linear processes
- **Interactive Canvas** - Drag, edit, connect nodes with full undo/redo support
- **Smart Layout** - Auto-arranges nodes with Dagre layout algorithm
- **Export** - Save diagrams as PNG or PDF
- **Persistent Storage** - All flows saved locally with auto-save

## Tech Stack

- **Electron** - Native macOS app with frameless window
- **React** - UI framework with React Router for navigation
- **ReactFlow** - Canvas and diagram editing
- **Anthropic Claude API** - AI-powered diagram generation
- **Whisper AI** (@xenova/transformers) - On-device speech recognition
- **TypeScript** - Type-safe development
- **Vite** - Fast build tooling

## Development

### Prerequisites

- Node.js 20+
- npm
- Anthropic API key

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Building

```bash
# Build for production (creates DMG installers)
npm run electron:build
```

Release builds will be created in the `release/` directory for both Intel and ARM64 Macs.

## Usage

1. Launch FlowMind and add your Anthropic API key in Settings
2. Click "New Flow" to start recording
3. Describe your workflow (or type it in the text box)
4. Click "Generate Flow" to create your diagram
5. Edit, rearrange, and export your diagram

## Project Structure

```
flowmind/
├── src/
│   ├── components/      # React components
│   ├── services/        # Claude API, speech, transcription
│   ├── store/          # Zustand state management
│   ├── styles/         # Theme and global styles
│   └── types/          # TypeScript types
├── electron/           # Electron main process
├── assets/            # App icons
└── release/           # Built applications
```

## License

MIT
