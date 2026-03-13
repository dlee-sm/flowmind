// =============================================================================
// FlowMind — Shared TypeScript Types
// Single source of truth. Import from here everywhere; never redeclare locally.
// =============================================================================

// ── Primitive domain literals ─────────────────────────────────────────────────

/** The five custom React Flow node shapes supported by FlowMind. */
export type NodeType =
  | 'startEnd'  // Teal rounded pill  — entry / exit
  | 'process'   // Purple rectangle   — action step
  | 'decision'  // Orange diamond     — yes/no branch
  | 'swimlane'  // Grouped container  — role / department lane
  | 'mindmap'   // Soft circle        — topic / subtopic

/** The four diagram layouts Claude can choose from. */
export type DiagramType =
  | 'flowchart'  // Linear process with decisions/branches
  | 'swimlane'   // Multi-role or multi-department workflow
  | 'mindmap'    // Brainstorming / topic exploration
  | 'linear'     // Simple numbered sequential steps

/** Supported export file formats. */
export type ExportFormat = 'png' | 'pdf' | 'svg'

// ── Const arrays (for iteration / runtime validation) ─────────────────────────

export const NODE_TYPES = [
  'startEnd', 'process', 'decision', 'swimlane', 'mindmap',
] as const satisfies readonly NodeType[]

export const DIAGRAM_TYPES = [
  'flowchart', 'swimlane', 'mindmap', 'linear',
] as const satisfies readonly DiagramType[]

export const EXPORT_FORMATS = [
  'png', 'pdf', 'svg',
] as const satisfies readonly ExportFormat[]

// ── UI label / icon maps (used on Home cards, toolbar badge, Record preview) ──

export const DIAGRAM_TYPE_LABELS: Record<DiagramType, string> = {
  flowchart: 'Flowchart',
  swimlane:  'Swimlane',
  mindmap:   'Mind Map',
  linear:    'Linear Steps',
}

export const DIAGRAM_TYPE_ICONS: Record<DiagramType, string> = {
  flowchart: '⬛',
  swimlane:  '⊞',
  mindmap:   '◉',
  linear:    '▶',
}

// ── React Flow node data payload ──────────────────────────────────────────────

/**
 * The `data` prop every custom node component receives from React Flow.
 * Using `NodeProps<NodeData>` instead of bare `NodeProps` eliminates
 * all `data.label as string` casts across node components.
 */
export interface NodeData {
  /** Display text rendered inside the node, editable on double-click. */
  label: string
  /** Swimlane nodes carry a role / department name for lane grouping. */
  lane?: string
}

// ── Flow document types ───────────────────────────────────────────────────────

/** A single node in a FlowMind diagram — stored locally and sent to the API. */
export interface FlowNode {
  id:       string
  type:     NodeType
  label:    string
  position: { x: number; y: number }
  /** Present only on swimlane nodes — the lane name (role/department). */
  lane?:    string
}

/** A directed edge connecting two nodes. */
export interface FlowEdge {
  id:     string
  source: string   // id of the source node
  target: string   // id of the target node
  /** Optional label shown on the edge, e.g. "Yes" / "No" at decision branches. */
  label?: string
}

/** The complete flow document — persisted to electron-store and loaded on Home. */
export interface FlowData {
  id:          string
  title:       string
  diagramType: DiagramType
  nodes:       FlowNode[]
  edges:       FlowEdge[]
  createdAt:   string   // ISO-8601
  updatedAt:   string   // ISO-8601
}

// ── Claude API contract ───────────────────────────────────────────────────────

/**
 * Structured JSON returned by Claude in response to a transcript.
 * Matches the exact schema defined in CLAUDE.md § "Expected Response JSON".
 */
export interface ClaudeResponse {
  diagramType: DiagramType
  /** Claude's explanation of why it chose this diagram type — shown as a toast. */
  reason:      string
  title:       string
  nodes:       FlowNode[]
  edges:       FlowEdge[]
}

// ── Application settings ──────────────────────────────────────────────────────

/** Persisted application preferences (currently just the API key). */
export interface AppSettings {
  apiKey: string
}

// ── IPC result types ──────────────────────────────────────────────────────────

/**
 * Returned by the `testApiKey` IPC handler in electron/main.ts.
 * The test is performed in the main process so the key never reaches the renderer.
 */
export interface TestResult {
  ok:      boolean
  message: string
}

// ── Runtime type guards ───────────────────────────────────────────────────────

export function isNodeType(value: unknown): value is NodeType {
  return typeof value === 'string' &&
    (NODE_TYPES as readonly string[]).includes(value)
}

export function isDiagramType(value: unknown): value is DiagramType {
  return typeof value === 'string' &&
    (DIAGRAM_TYPES as readonly string[]).includes(value)
}

/**
 * Validates that a parsed JSON object has the shape of a ClaudeResponse.
 * Call this immediately after JSON.parse() in src/services/claude.ts.
 */
export function isValidClaudeResponse(value: unknown): value is ClaudeResponse {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  return (
    isDiagramType(r.diagramType) &&
    typeof r.reason === 'string' &&
    typeof r.title  === 'string' &&
    Array.isArray(r.nodes) &&
    Array.isArray(r.edges)
  )
}

// ── Window / IPC bridge ───────────────────────────────────────────────────────
// Must stay in sync with electron/preload.ts exactly.

declare global {
  interface Window {
    electronAPI: {
      /** Return the currently stored Anthropic API key (empty string if none). */
      getApiKey:  ()                   => Promise<string>
      /** Encrypt and persist the Anthropic API key. */
      saveApiKey: (key: string)        => Promise<boolean>
      /**
       * Validate a key by making a real API call from the main process.
       * Returns { ok, message } — the key never travels back to the renderer.
       */
      testApiKey: (key: string)        => Promise<TestResult>
      /** Upsert a flow document to encrypted local storage. */
      saveFlow:   (flow: FlowData)     => Promise<boolean>
      /** Load all saved flows, sorted newest-first. */
      loadFlows:  ()                   => Promise<FlowData[]>
      /** Remove a flow by id. */
      deleteFlow: (id: string)         => Promise<boolean>
      /**
       * Call the Anthropic API from the main process (avoids renderer CORS block).
       * Returns raw response body text; the renderer handles JSON parsing.
       */
      callClaude: (transcript: string) => Promise<string>
      /** Transcribe 16 kHz mono audio via on-device Whisper in the main process. */
      transcribeAudio: (samples: Float32Array) => Promise<string>
      /** Pre-warm the Whisper worker (triggers model download on first run). */
      initWhisper: () => Promise<void>
      /**
       * Subscribe to Whisper model download / load progress events.
       * Returns an unsubscribe function — call it in useEffect cleanup.
       */
      onWhisperProgress: (
        cb: (p: WhisperProgress) => void
      ) => () => void
    }
  }
}

/** Progress event emitted by @xenova/transformers during model download/load. */
export interface WhisperProgress {
  type:      string
  status?:   string
  file?:     string
  progress?: number   // 0–100
  loaded?:   number   // bytes
  total?:    number   // bytes
}
