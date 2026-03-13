import { contextBridge, ipcRenderer } from 'electron'

// ── Types mirrored here so the renderer gets proper autocomplete ──────────────
// (We can't import from src/types in a preload — it runs in a separate context.)

export interface TestResult {
  ok:      boolean
  message: string
}

// ── IPC bridge ────────────────────────────────────────────────────────────────
// Only these channels are whitelisted. The renderer cannot call any other
// ipcRenderer method — contextIsolation: true enforces that boundary.

contextBridge.exposeInMainWorld('electronAPI', {
  /** Retrieve the currently saved Anthropic API key (empty string if none). */
  getApiKey: (): Promise<string> =>
    ipcRenderer.invoke('get-api-key'),

  /** Encrypt and persist the Anthropic API key via electron-store. */
  saveApiKey: (key: string): Promise<boolean> =>
    ipcRenderer.invoke('save-api-key', key),

  /**
   * Send a lightweight API request from the main process to validate a key.
   * Returns { ok, message } — the key itself never travels back to the renderer.
   */
  testApiKey: (key: string): Promise<TestResult> =>
    ipcRenderer.invoke('test-api-key', key),

  /** Upsert a flow object to encrypted local storage. */
  saveFlow: (flow: unknown): Promise<boolean> =>
    ipcRenderer.invoke('save-flow', flow),

  /** Load all saved flows, sorted newest-first. */
  loadFlows: (): Promise<unknown[]> =>
    ipcRenderer.invoke('load-flows'),

  /** Delete a flow by id. */
  deleteFlow: (id: string): Promise<boolean> =>
    ipcRenderer.invoke('delete-flow', id),

  /**
   * Send a transcript to the Anthropic API from the main process (bypasses
   * the CORS restriction that blocks renderer-side fetch to api.anthropic.com).
   * Returns the raw response body text; the renderer handles JSON parsing.
   */
  callClaude: (transcript: string): Promise<string> =>
    ipcRenderer.invoke('call-claude', transcript),

  /**
   * Transcribe 16 kHz mono audio samples using on-device Whisper (runs in
   * the main process, which has Node.js fs access required by onnxruntime).
   */
  transcribeAudio: (samples: Float32Array): Promise<string> =>
    ipcRenderer.invoke('transcribe-audio', samples),

  /**
   * Trigger Whisper worker pre-warm so the model is downloaded/loaded before
   * the user first clicks the microphone.
   */
  initWhisper: (): Promise<void> =>
    ipcRenderer.invoke('init-whisper'),

  /**
   * Subscribe to Whisper model download / load progress events.
   * The callback receives the raw @xenova/transformers progress object.
   * Returns an unsubscribe function to clean up the listener.
   */
  onWhisperProgress: (
    cb: (p: { type: string; status?: string; file?: string; progress?: number; loaded?: number; total?: number }) => void
  ): (() => void) => {
    const handler = (_event: unknown, p: unknown) => cb(p as Parameters<typeof cb>[0])
    ipcRenderer.on('whisper-progress', handler)
    return () => ipcRenderer.removeListener('whisper-progress', handler)
  },
})
