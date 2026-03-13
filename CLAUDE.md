# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FlowMind is an Electron desktop application (macOS) that transforms spoken workflows into visual diagrams using AI. Users speak naturally about their processes, and the app uses on-device Whisper transcription + Claude API to generate flowcharts, swimlane diagrams, mind maps, and linear process diagrams.

## Tech Stack

- **Electron** 28 - Native macOS app with frameless window, vibrancy, and transparency
- **React** 18 + **React Router** 6 - UI framework with client-side routing
- **TypeScript** 5.3 - Type-safe development throughout
- **Vite** 5 - Fast build tooling and development server
- **ReactFlow** 11 - Interactive canvas and diagram editing
- **Zustand** 4 - Lightweight state management (single store at `src/store/useFlowStore.ts`)
- **Anthropic Claude API** - AI-powered diagram generation (claude-sonnet-4-6)
- **Whisper AI** (@xenova/transformers) - On-device speech recognition (whisper-base.en quantized)
- **Dagre** - Auto-layout algorithm for node positioning
- **electron-store** - Encrypted persistent storage for API keys and flows
- **html2canvas + jsPDF** - Export to PNG/PDF

## Development Commands

```bash
# Install dependencies
npm install

# Run in development mode (starts Vite dev server + Electron)
npm run dev

# Build renderer only (TypeScript + Vite)
npm run build

# Build complete Electron app (DMG installers for Intel and ARM64)
npm run electron:build
```

Release builds are created in the `release/` directory with separate DMG files for x64 and arm64 macOS architectures.

## Architecture

### Electron Process Model

FlowMind uses Electron's standard multi-process architecture with strict security boundaries:

**Main Process** (`electron/main.ts`)
- Manages the native BrowserWindow
- Hosts all IPC handlers (`ipcMain.handle`)
- Runs Claude API calls via `net.fetch` (bypasses renderer CORS restrictions)
- Manages Whisper Worker Thread for CPU-intensive transcription
- Handles all persistent storage operations via electron-store

**Preload Script** (`electron/preload.ts`)
- Exposes a whitelisted `window.electronAPI` bridge via `contextBridge`
- Enforces strict type contracts between renderer and main process
- All IPC channels must be explicitly listed here

**Renderer Process** (`src/`)
- React SPA with React Router for navigation
- No direct Node.js or Electron API access (contextIsolation enforced)
- Communicates with main process exclusively via `window.electronAPI`

### IPC Communication Patterns

All IPC calls are asynchronous (`ipcMain.handle` + `ipcRenderer.invoke`). Key channels:

- `call-claude` - Send transcript to Claude API, returns raw JSON response
- `transcribe-audio` - Send Float32Array samples to Whisper worker, returns transcript
- `init-whisper` - Pre-warm Whisper model (called on app mount)
- `whisper-progress` - Progress events during model download/load (one-way: main → renderer)
- `get-api-key`, `save-api-key`, `test-api-key` - API key management
- `save-flow`, `load-flows`, `delete-flow` - Flow persistence

### Whisper Worker Thread Architecture

On-device transcription runs in a separate Worker Thread to prevent blocking the Electron main thread:

1. Worker spawned in `electron/main.ts` via Node.js `worker_threads`
2. Worker script: `electron/whisper-worker.ts` (bundled by Vite alongside main.ts)
3. Model cached at `{userData}/whisper-cache/`
4. Progress forwarded: worker → main → renderer via `whisper-progress` IPC events
5. 5-minute timeout per transcription (covers model load + ~12 chunks of 30s audio)
6. Race condition prevention: `_initPromise` stored at module level, awaited before pipeline calls

**Critical Build Detail**: `onnxruntime-node` and `sharp` (Whisper dependencies with native `.node` binaries) are marked as Rollup externals in `vite.config.ts` so Node.js resolves them from `node_modules/` at runtime.

### State Management (Zustand)

Single global store at `src/store/useFlowStore.ts`:

- `currentFlow` - The flow being edited on the Canvas
- `savedFlows` - All persisted flows (loaded from electron-store on Home mount)
- `history` / `historyIndex` - Undo/redo stack (capped at 50 entries)
- `isModified` - Unsaved changes indicator (triggers auto-save debounce)
- `hasApiKey` - Whether user has configured an Anthropic API key
- `aiInsightReason` - Claude's explanation for diagram type choice (shown as toast after generation)

State mutations that modify nodes/edges/title automatically set `isModified: true`. The Canvas component debounces auto-save (500ms) on any change.

### Type System

All types defined in a single source of truth: `src/types/index.ts`

Key types:
- `FlowData` - Complete flow document (persisted to electron-store)
- `FlowNode` - Single node with id, type, label, position, and optional lane
- `FlowEdge` - Directed edge with id, source, target, and optional label
- `NodeType` - Five custom node shapes: startEnd, process, decision, swimlane, mindmap
- `DiagramType` - Four layout types: flowchart, swimlane, mindmap, linear
- `ClaudeResponse` - Structured JSON returned by Claude API
- `WhisperProgress` - Progress events from @xenova/transformers

Runtime type guards: `isNodeType()`, `isDiagramType()`, `isValidClaudeResponse()`

### Component Structure

**Pages** (React Router routes):
- `src/components/Home.tsx` - Flow list with thumbnail cards (`/`)
- `src/components/Canvas.tsx` - ReactFlow canvas and editing UI (`/canvas/:id`)
- `src/components/Settings.tsx` - API key input and connection test (`/settings`)

**Modals**:
- `src/components/Record.tsx` - Voice recording modal with live waveform visualization
- `src/components/ExportModal.tsx` - PNG/PDF export with html2canvas + jsPDF

**Custom ReactFlow Nodes** (`src/components/nodes/`):
- `ProcessNode.tsx` - Purple rectangle (action step)
- `DecisionNode.tsx` - Orange diamond (yes/no branch)
- `StartEndNode.tsx` - Teal rounded pill (entry/exit)
- `SwimlaneNode.tsx` - Grouped container with lane label (role/department)
- `MindMapNode.tsx` - Soft circle (topic/subtopic)

All nodes support:
- In-place label editing (double-click)
- Delete button on hover (top-right corner, red ×)
- Access to `deleteNode()` via CanvasContext (avoids threading through ReactFlow data props)

**Services** (`src/services/`):
- `claude.ts` - Calls `window.electronAPI.callClaude()`, parses/validates ClaudeResponse
- `transcription.ts` - Resamples audio to 16kHz mono, calls `window.electronAPI.transcribeAudio()`
- `speech.ts` - Microphone capture via AudioWorklet (replaced deprecated ScriptProcessorNode)
- `export.ts` - Canvas screenshot with html2canvas, PNG/PDF generation

### Canvas & ReactFlow Integration

**Auto-layout**: Dagre algorithm (⊞ Layout button) - arranges nodes top-to-bottom or left-to-right depending on diagram type

**Undo/Redo**: Full history stack with keyboard shortcuts (⌘Z / ⌘⇧Z) and toolbar buttons. Each edit pushes a snapshot of `{ nodes, edges }` to the history array.

**Auto-save**: Debounced 500ms write to electron-store whenever `isModified` becomes true. The Canvas component watches `isModified` and calls `saveFlow()` via useEffect.

**Unsaved indicator**: Orange dot in title when `isModified === true`

**CanvasContext**: React context at `src/components/CanvasContext.ts` provides `deleteNode()` to all custom node components. This avoids lost references during undo/redo (ReactFlow's `data` prop is replaced on history restore).

### Claude API Integration

**System Prompt**: Full JSON schema embedded in `electron/main.ts` (lines 97–145). Claude returns structured data matching `ClaudeResponse` type.

**Error Handling**: User-friendly messages for 401 (invalid key), 403 (access denied), 429 (rate limit), 5xx (API unavailable). API key validation via `test-api-key` handler (makes minimal call with max_tokens: 1).

**CORS Bypass**: All API calls originate from the main process via Electron's `net.fetch`, never from the renderer. This avoids Chromium's CORS restrictions on `api.anthropic.com`.

### Audio Recording Architecture

Microphone capture uses AudioWorklet (not deprecated ScriptProcessorNode):

1. Inline Blob URL worklet sends raw PCM chunks + RMS level events to main thread
2. Silent GainNode (gain = 0) drives audio graph so recording works without audible monitor feedback
3. 10 animated teal bars visualize real-time audio level via direct DOM manipulation (no React re-renders at 30 FPS)
4. Audio resampled to 16kHz mono Float32Array before sending to Whisper

### Persistent Storage

**electron-store** at `electron/store.ts`:
- API key stored encrypted
- Flows stored as array of `FlowData` objects
- Auto-sorted newest-first on load
- Storage location: `{userData}/config.json`

## Key Files

- `electron/main.ts` - Electron main process, IPC handlers, window management
- `electron/preload.ts` - IPC bridge, exposes `window.electronAPI`
- `electron/whisper-worker.ts` - Worker thread for CPU-intensive Whisper transcription
- `electron/store.ts` - electron-store wrapper for persistent storage
- `src/store/useFlowStore.ts` - Zustand global state (single source of truth)
- `src/types/index.ts` - All TypeScript types and type guards
- `src/components/Canvas.tsx` - Main editing UI with ReactFlow integration
- `src/services/claude.ts` - Claude API integration
- `vite.config.ts` - Critical externals config for native binaries (onnxruntime-node, sharp)
- `electron-builder.yml` - DMG build configuration

## Development Notes

### Anthropic API Key

Users must provide their own Anthropic API key in Settings. The app validates keys by making a test API call (claude-haiku-4-5-20251001 with max_tokens: 1). Keys are stored encrypted via electron-store.

### First-Time Model Download

When a user first records audio, Whisper downloads ~70MB of model files to `{userData}/whisper-cache/`. Progress is shown in the UI. Subsequent runs load instantly from cache.

### DevTools

DevTools are suppressed in production (auto-closed on open event) but available in development mode.

### macOS-Specific Features

- Frameless window with native traffic-light buttons (`titleBarStyle: 'hiddenInset'`)
- Vibrancy and transparency effects (`vibrancy: 'under-window'`)
- App name set to "FlowMind" before `app.whenReady()` (shows correctly in menu bar and Dock)
- Custom app icon applied to Dock and window

### Testing API Key

The Settings screen includes a "Test Connection" button that validates the API key by making a real but minimal API call. This ensures the key works before the user attempts to generate a diagram.
