# FlowMind Changelog

All notable changes to this project are documented here.

---

## [0.2.0] — 2026-03-04

### Added
- **Delete node button** — Hovering over any node reveals a red × button (top-right corner). Clicking it removes the node and all of its connected edges in one action, pushes an undo snapshot, and marks the flow as dirty for auto-save.
- **CanvasContext** — New React context (`src/components/CanvasContext.ts`) that passes `deleteNode` to all custom node components without threading it through ReactFlow `data` props (which would be lost on undo/redo).

---

## [0.1.0] — 2026-03-03

### Core application (initial build)

#### Electron shell
- macOS frameless window with native traffic-light buttons, vibrancy, and transparency.
- App name set to "FlowMind" before `app.whenReady()` so the macOS menu bar and Dock always show the correct name.
- DevTools suppressed in production (auto-closed on open event).
- App icon (`assets/icon.png`) applied to Dock and window.

#### Persistent storage
- `electron-store`-backed persistence for API key (encrypted) and saved flows.
- IPC handlers: `get-api-key`, `save-api-key`, `save-flow`, `load-flows`, `delete-flow`.

#### Claude integration
- Moved API call from renderer `fetch()` to main-process `net.fetch` (`call-claude` IPC handler) to bypass Chromium CORS restrictions on `api.anthropic.com`.
- Full JSON schema injected into `CLAUDE_SYSTEM_PROMPT` so Claude returns structured diagram data reliably.
- API key validation via `test-api-key` IPC handler (uses `claude-haiku-4-5-20251001` with `max_tokens: 1`).
- User-friendly error messages for 401, 403, 429, and 5xx responses.

#### Whisper speech-to-text
- On-device transcription via `@xenova/transformers` (`Xenova/whisper-base.en`, quantized) running in a Node.js Worker Thread to keep the Electron main thread responsive.
- Worker pre-warmed on app mount (`init-whisper` IPC) so model is ready before the user speaks.
- Model download/load progress forwarded from worker → main → renderer via `whisper-progress` IPC event; renderer shows file name and byte progress bar.
- Long-form transcription enabled with `chunk_length_s: 30, stride_length_s: 5` — accurate on recordings up to 5 minutes.
- 5-minute transcription timeout (covers model load + ~12 chunks of inference on Apple Silicon).
- Race condition fixed: `_initPromise` stored at module level and awaited inside the message handler before calling `_pipeline`.
- `onnxruntime-node` and `sharp` marked as Rollup externals so their native `.node` binaries resolve correctly at runtime.

#### Audio recording
- Microphone capture via `AudioWorklet` (replaced deprecated `ScriptProcessorNode` which caused Chromium native audio thread crashes).
- Inline Blob URL worklet sends raw PCM chunks and RMS level events back to the main thread.
- 10 animated teal bars visualize real-time audio level via direct DOM manipulation (no React re-renders at 30 FPS).
- Silent `GainNode` (gain = 0) drives the audio graph so recording works without audible monitor feedback.

#### Canvas & diagram editing (ReactFlow)
- Five custom node types: `process`, `decision`, `startEnd`, `swimlane`, `mindmap`.
- In-place label editing on double-click for all node types.
- Edge connect, drag-to-reposition, Delete-key edge removal — all with undo/redo history.
- Dagre auto-layout (⊞ Layout button).
- Zoom fit (⤢ Fit button).
- Undo/Redo: `⌘Z` / `⌘⇧Z` keyboard shortcuts + toolbar buttons.
- Floating glassmorphism toolbar: breadcrumb, editable title, diagram-type badge, +Node dropdown, Layout, Fit, Undo, Redo, Export.
- AI insight toast — displays Claude's diagram-type reasoning for 5 seconds after generation.
- Auto-save: debounced 500 ms write to `electron-store` on any change.
- Unsaved-changes indicator (orange dot in title).
- Export modal: PNG and PDF export via `html2canvas` + `jsPDF`.

#### Home screen
- Flow list with thumbnail cards.
- Record button → opens Record modal for voice input.
- New flow creation from voice transcript → navigates to Canvas.
- Delete flow from home screen.

#### Settings screen
- API key input with show/hide toggle.
- "Test Connection" button that makes a real API call and reports success/failure.

#### Routing
- React Router v6: `/` (Home), `/canvas/:id` (Canvas), `/settings` (Settings).
