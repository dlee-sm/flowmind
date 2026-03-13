import { app, BrowserWindow, ipcMain, net } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { getApiKey, saveApiKey, saveFlow, loadFlows, deleteFlow } from './store'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Set app name early — before app.whenReady() — so the macOS menu bar
// shows "FlowMind" instead of "Electron" even in development mode.
app.name = 'FlowMind'

// Paths -----------------------------------------------------------------------
process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST           = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST       = path.join(process.env.APP_ROOT, 'dist')

// In dev the renderer is served by Vite; in prod it's a built file.
// VITE_PUBLIC is used only for static assets that Vite's publicDir would serve.
// We set publicDir:false in vite.config so assets live under /assets/ via the
// bundler — we only need RENDERER_DIST here.
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? process.env.APP_ROOT
  : RENDERER_DIST

let win: BrowserWindow | null = null

const ICON_PATH = path.join(process.env.APP_ROOT!, 'assets', 'icon.png')

// Window ----------------------------------------------------------------------
function createWindow() {
  const isMac = process.platform === 'darwin'

  if (isMac && app.dock) {
    app.dock.setIcon(ICON_PATH)
  }

  win = new BrowserWindow({
    width:     1200,
    height:    800,
    minWidth:  900,
    minHeight: 600,
    show: false, // reveal only after content is ready — prevents white flash

    // ── macOS: frameless with native traffic-light buttons + vibrancy ──
    ...(isMac
      ? {
          titleBarStyle:     'hiddenInset' as const,
          vibrancy:          'under-window' as const,
          visualEffectState: 'active' as const,
          transparent:       true,
        }
      : {
          // Windows / Linux: keep a standard frame
          frame: true,
          backgroundColor: '#F9F7F4',
        }),

    icon: ICON_PATH,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false, // required for electron-store IPC to work properly
    },
  })

  // Grant microphone permissions.
  win.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    const allowed = new Set(['media', 'mediaKeySystem', 'microphone'])
    callback(allowed.has(permission))
  })

  // Electron persists DevTools state — close them every time they try to open.
  win.webContents.on('devtools-opened', () => {
    win?.webContents.closeDevTools()
  })

  // Show the window only after the renderer has finished painting its first frame.
  win.once('ready-to-show', () => {
    win?.show()
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// IPC handlers ----------------------------------------------------------------

// System prompt for diagram generation — lives here (main process) so the full
// API call stays server-side and is never subject to CORS restrictions.
const CLAUDE_SYSTEM_PROMPT = `You are a workflow diagram expert. A user has described their work process by speaking aloud.
Your job is to:
1. Analyze the transcript
2. Choose the best diagram type: flowchart, swimlane, mindmap, or linear
3. Return ONLY valid JSON matching the exact schema below — no markdown, no explanation

Diagram type rules:
- "flowchart"  — processes with decisions or branches (if/yes/no)
- "swimlane"   — multiple roles or departments involved
- "mindmap"    — exploratory / brainstorming descriptions
- "linear"     — simple sequential step-by-step processes

Node type rules:
- "startEnd"  — first and last nodes only (entry / exit)
- "process"   — regular action step
- "decision"  — yes/no branch (flowchart only)
- "swimlane"  — use when diagramType is "swimlane"; always include a "lane" field
- "mindmap"   — use when diagramType is "mindmap"

Other rules:
- Keep node labels concise (3–6 words)
- Generate between 4 and 12 nodes (never fewer, never more)
- Position nodes top-to-bottom for flowchart/linear, left-to-right for swimlane
- Space nodes ~150px apart (x or y depending on layout direction)
- Every edge id must be unique; source/target must match node ids exactly

Required JSON schema (return exactly this structure, nothing else):
{
  "diagramType": "flowchart" | "swimlane" | "mindmap" | "linear",
  "reason": "<one sentence explaining why you chose this diagram type>",
  "title": "<short descriptive title for the diagram>",
  "nodes": [
    {
      "id": "n1",
      "type": "startEnd" | "process" | "decision" | "swimlane" | "mindmap",
      "label": "<concise node label>",
      "position": { "x": 300, "y": 50 },
      "lane": "<role or department name>"  // only required when diagramType is "swimlane"
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "n1",
      "target": "n2",
      "label": "<optional edge label, e.g. Yes / No>"
    }
  ]
}`

/**
 * Send a transcript to the Anthropic API from the main process.
 * Using net.fetch (not renderer fetch) avoids the CORS restriction that
 * Chromium enforces when the renderer calls api.anthropic.com directly.
 * Returns the raw response body text; the renderer handles parsing/validation.
 */
ipcMain.handle('call-claude', async (_event, transcript: string): Promise<string> => {
  const apiKey = getApiKey()
  if (!apiKey.trim()) {
    throw new Error('No API key configured. Please add your Anthropic API key in Settings.')
  }

  let response: Response
  try {
    response = await net.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 4096,
        system:     CLAUDE_SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: JSON.stringify({ transcript }) }],
      }),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Network error: ${msg}`)
  }

  const body = await response.text()
  if (!response.ok) {
    if (response.status === 401) throw new Error('Invalid API key. Please update your Anthropic API key in Settings.')
    if (response.status === 403) throw new Error('API access denied. Please verify your API key has the correct permissions.')
    if (response.status === 429) throw new Error('Rate limit exceeded. Please wait a moment and try again.')
    if (response.status >= 500) throw new Error('The Anthropic API is temporarily unavailable. Please try again in a moment.')
    throw new Error(`API error (${response.status}). Please try again.`)
  }

  return body
})

/** Return the saved API key (or empty string). */
ipcMain.handle('get-api-key', (): string => {
  return getApiKey()
})

/** Persist the API key encrypted via electron-store. */
ipcMain.handle('save-api-key', (_event, key: string): boolean => {
  saveApiKey(key)
  return true
})

/** Upsert a flow to persistent storage. */
ipcMain.handle('save-flow', (_event, flow: unknown): boolean => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveFlow(flow as any)
  return true
})

/** Return all saved flows. */
ipcMain.handle('load-flows', () => {
  return loadFlows()
})

/** Remove a flow by id. */
ipcMain.handle('delete-flow', (_event, id: string): boolean => {
  deleteFlow(id)
  return true
})

/**
 * Test an API key by making a real (minimal) call to the Anthropic API
 * entirely inside the main process — the key never touches the renderer.
 *
 * Returns { ok: boolean; message: string }.
 */
ipcMain.handle(
  'test-api-key',
  async (_event, key: string): Promise<{ ok: boolean; message: string }> => {
    if (!key || !key.startsWith('sk-ant-')) {
      return { ok: false, message: 'Key must start with sk-ant-' }
    }

    try {
      const response = await net.fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'x-api-key':         key,
          'anthropic-version': '2023-06-01',
          'content-type':      'application/json',
        },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 1,
          messages:   [{ role: 'user', content: 'hi' }],
        }),
      })

      if (response.status === 200 || response.status === 400) {
        // 400 means the payload was understood — key is valid
        return { ok: true, message: 'Connection successful!' }
      }
      if (response.status === 401) {
        return { ok: false, message: 'Invalid API key.' }
      }
      if (response.status === 429) {
        // Rate-limited but key is authentic
        return { ok: true, message: 'Key valid (rate limited — wait and retry).' }
      }
      return { ok: false, message: `Unexpected status: ${response.status}` }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, message: `Network error: ${msg}` }
    }
  }
)

// ── Whisper transcription via Worker Thread ───────────────────────────────────
// @xenova/transformers needs Node.js fs/path — it must run in the main process,
// not the renderer. We further offload it to a Worker Thread so that the
// CPU-intensive ML inference never blocks Electron's main thread (which would
// freeze the entire UI and all IPC).

type PendingReq = { resolve: (t: string) => void; reject: (e: Error) => void }
let _worker:      Worker | null = null
const _pending = new Map<string, PendingReq>()

function getWhisperWorker(): Worker {
  if (_worker) return _worker

  _worker = new Worker(path.join(__dirname, 'whisper-worker.js'), {
    workerData: { cacheDir: path.join(app.getPath('userData'), 'whisper-cache') },
  })

  _worker.on('message', (msg: { type: string; id?: string; text?: string; message?: string; [key: string]: unknown }) => {
    if (msg.type === 'init-error') {
      // Worker failed to load the model — reject ALL pending requests
      const err = new Error(msg.message ?? 'Whisper model failed to load.')
      _pending.forEach((req) => req.reject(err))
      _pending.clear()
      return
    }

    // Forward download / load progress events to all renderer windows
    if (msg.type === 'progress' || msg.type === 'ready') {
      BrowserWindow.getAllWindows().forEach((w) => {
        if (!w.isDestroyed()) w.webContents.send('whisper-progress', msg)
      })
      return
    }

    if (msg.type !== 'result' && msg.type !== 'error') return
    const req = _pending.get(msg.id ?? '')
    if (!req) return
    _pending.delete(msg.id ?? '')
    msg.type === 'error'
      ? req.reject(new Error(msg.message ?? 'Transcription failed'))
      : req.resolve(msg.text ?? '')
  })

  _worker.on('error', (err) => {
    _pending.forEach((req) => req.reject(err))
    _pending.clear()
    _worker = null
  })

  _worker.on('exit', () => { _worker = null })

  return _worker
}

/**
 * Pre-warm the Whisper worker (triggers model download on first run).
 * The renderer calls this on mount so the model is ready before the user speaks.
 */
ipcMain.handle('init-whisper', (): void => {
  getWhisperWorker()
})

/**
 * Transcribe pre-resampled 16 kHz mono Float32Array audio.
 * Offloaded to a Worker Thread — the main thread stays responsive.
 */
ipcMain.handle('transcribe-audio', (_event, samples: Float32Array): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 5-minute timeout — covers model load + chunked inference for long recordings.
    // whisper-base.en processes ~30 s chunks at ~2 s/chunk on Apple Silicon, so
    // a 5-minute recording (~12 chunks) takes roughly 30–60 s of inference.
    const timer = setTimeout(() => {
      _pending.delete(id)
      reject(new Error('Transcription timed out. Please try a shorter recording or try again.'))
    }, 300_000)

    const worker = getWhisperWorker()
    const id = Math.random().toString(36).slice(2)
    _pending.set(id, {
      resolve: (t) => { clearTimeout(timer); resolve(t) },
      reject:  (e) => { clearTimeout(timer); reject(e)  },
    })
    worker.postMessage({ type: 'transcribe', id, samples }, [samples.buffer as ArrayBuffer])
  })
})

// App lifecycle ---------------------------------------------------------------

app.on('window-all-closed', () => {
  // On macOS apps stay open in the Dock after all windows are closed
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // Re-create the window when the Dock icon is clicked and no windows exist
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
