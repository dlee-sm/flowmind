import Store from 'electron-store'
import { app } from 'electron'

// ── Types (kept local to avoid importing from src/ in the main process) ──────
// These mirror src/types/index.ts — keep in sync manually.
export interface StoredNode {
  id:       string
  type:     string
  label:    string
  position: { x: number; y: number }
  lane?:    string
}

export interface StoredEdge {
  id:     string
  source: string
  target: string
  label?: string
}

export interface StoredFlow {
  id:          string
  title:       string
  diagramType: string
  nodes:       StoredNode[]
  edges:       StoredEdge[]
  createdAt:   string
  updatedAt:   string
}

interface StoreSchema {
  apiKey: string
  flows:  StoredFlow[]
}

// ── Encryption key ────────────────────────────────────────────────────────────
// Derived from the app's user-data path so it is machine-specific.
// Falls back to a static seed before app is ready (e.g. in tests).
function deriveEncryptionKey(): string {
  try {
    // app.getPath throws before app is ready — handled by the catch
    const userData = app.getPath('userData')
    return `flowmind:${userData}:sondermind`
  } catch {
    return 'flowmind-sondermind-internal'
  }
}

// ── Store instance ────────────────────────────────────────────────────────────
const store = new Store<StoreSchema>({
  name:          'flowmind-data',
  encryptionKey: deriveEncryptionKey(), // AES-256-CBC encrypts the entire store file
  defaults: {
    apiKey: '',
    flows:  [],
  },
  // JSON schema validation — keeps corrupt data from crashing the app
  schema: {
    apiKey: { type: 'string' },
    flows: {
      type:  'array',
      items: {
        type: 'object',
        properties: {
          id:          { type: 'string' },
          title:       { type: 'string' },
          diagramType: { type: 'string' },
          nodes:       { type: 'array' },
          edges:       { type: 'array' },
          createdAt:   { type: 'string' },
          updatedAt:   { type: 'string' },
        },
        required: ['id', 'title', 'diagramType', 'nodes', 'edges', 'createdAt', 'updatedAt'],
      },
    },
  },
})

// ── API Key ───────────────────────────────────────────────────────────────────

/** Returns the stored API key, or empty string if none saved. */
export function getApiKey(): string {
  return store.get('apiKey', '')
}

/** Encrypts and persists the API key. Pass empty string to clear. */
export function saveApiKey(key: string): void {
  store.set('apiKey', key.trim())
}

/** Returns true if an API key is currently stored. */
export function hasApiKey(): boolean {
  return store.get('apiKey', '').length > 0
}

// ── Flows ─────────────────────────────────────────────────────────────────────

/** Upsert a flow — inserts if new, replaces if id already exists. */
export function saveFlow(flow: StoredFlow): void {
  const flows = store.get('flows', [])
  const idx   = flows.findIndex((f) => f.id === flow.id)
  if (idx >= 0) {
    flows[idx] = flow
  } else {
    flows.push(flow)
  }
  store.set('flows', flows)
}

/** Returns all flows, newest-first by updatedAt. */
export function loadFlows(): StoredFlow[] {
  const flows = store.get('flows', [])
  return [...flows].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

/** Removes the flow with the given id (no-op if not found). */
export function deleteFlow(id: string): void {
  const flows = store.get('flows', [])
  store.set('flows', flows.filter((f) => f.id !== id))
}
