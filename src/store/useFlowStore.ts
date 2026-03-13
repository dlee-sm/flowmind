import { create } from 'zustand'
import type { FlowData, FlowNode, FlowEdge, DiagramType } from '../types'

interface HistoryEntry {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

interface FlowStore {
  // ── State ───────────────────────────────────────────────────────────────────
  currentFlow:     FlowData | null
  savedFlows:      FlowData[]
  history:         HistoryEntry[]
  historyIndex:    number
  isModified:      boolean
  hasApiKey:       boolean
  /** Claude's explanation of why it chose this diagram type — shown as a toast. */
  aiInsightReason: string

  // ── Actions ─────────────────────────────────────────────────────────────────
  setNodes:         (nodes: FlowNode[]) => void
  setEdges:         (edges: FlowEdge[]) => void
  setTitle:         (title: string) => void
  setDiagramType:   (type: DiagramType) => void
  pushHistory:      (nodes: FlowNode[], edges: FlowEdge[]) => void
  undo:             () => void
  redo:             () => void
  /** Create a fresh flow. Pass `reason` from ClaudeResponse to show as toast. */
  newFlow:          (data: Partial<FlowData>, reason?: string) => void
  loadFlow:         (flow: FlowData) => void
  /** Persist flow to electron-store and sync savedFlows list. */
  saveFlow:         (flow: FlowData) => Promise<void>
  setSavedFlows:    (flows: FlowData[]) => void
  setHasApiKey:     (val: boolean) => void
  markSaved:        () => void
}

export const useFlowStore = create<FlowStore>((set, get) => ({
  // ── Initial state ────────────────────────────────────────────────────────────
  currentFlow:     null,
  savedFlows:      [],
  history:         [],
  historyIndex:    -1,
  isModified:      false,
  hasApiKey:       false,
  aiInsightReason: '',

  // ── Mutations that mark the flow as modified ─────────────────────────────────

  setNodes: (nodes) => {
    const flow = get().currentFlow
    if (!flow) return
    set({ currentFlow: { ...flow, nodes }, isModified: true })
  },

  setEdges: (edges) => {
    const flow = get().currentFlow
    if (!flow) return
    set({ currentFlow: { ...flow, edges }, isModified: true })
  },

  setTitle: (title) => {
    const flow = get().currentFlow
    if (!flow) return
    set({ currentFlow: { ...flow, title }, isModified: true })
  },

  setDiagramType: (diagramType) => {
    const flow = get().currentFlow
    if (!flow) return
    set({ currentFlow: { ...flow, diagramType }, isModified: true })
  },

  // ── Undo / redo ──────────────────────────────────────────────────────────────

  pushHistory: (nodes, edges) => {
    const { history, historyIndex } = get()
    // Truncate any redo future, then append the new snapshot
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({ nodes, edges })
    // Cap at 50 entries — discard the oldest when over limit
    if (newHistory.length > 50) newHistory.shift()
    set({ history: newHistory, historyIndex: newHistory.length - 1 })
  },

  undo: () => {
    const { history, historyIndex, currentFlow } = get()
    // historyIndex 0 is the initial seeded state — can't go below it
    if (historyIndex <= 0 || !currentFlow) return
    const newIndex = historyIndex - 1
    const entry = history[newIndex]
    set({
      currentFlow: { ...currentFlow, nodes: entry.nodes, edges: entry.edges },
      historyIndex: newIndex,
      isModified: true,
    })
  },

  redo: () => {
    const { history, historyIndex, currentFlow } = get()
    if (historyIndex >= history.length - 1 || !currentFlow) return
    const newIndex = historyIndex + 1
    const entry = history[newIndex]
    set({
      currentFlow: { ...currentFlow, nodes: entry.nodes, edges: entry.edges },
      historyIndex: newIndex,
      isModified: true,
    })
  },

  // ── Flow lifecycle ───────────────────────────────────────────────────────────

  newFlow: (data, reason = '') => {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const flow: FlowData = {
      id,
      title:       'Untitled Flow',
      diagramType: 'flowchart',
      nodes:       [],
      edges:       [],
      createdAt:   now,
      updatedAt:   now,
      ...data,
    }
    // Seed history so the very first undo has a baseline to return to
    const initialEntry: HistoryEntry = { nodes: flow.nodes, edges: flow.edges }
    set({
      currentFlow:     flow,
      history:         [initialEntry],
      historyIndex:    0,
      isModified:      false,
      aiInsightReason: reason,
    })
  },

  loadFlow: (flow) => {
    // Seed history with the loaded snapshot as the undo baseline
    const initialEntry: HistoryEntry = { nodes: flow.nodes, edges: flow.edges }
    set({
      currentFlow:     flow,
      history:         [initialEntry],
      historyIndex:    0,
      isModified:      false,
      aiInsightReason: '',
    })
  },

  saveFlow: async (flow) => {
    const updatedFlow: FlowData = { ...flow, updatedAt: new Date().toISOString() }
    await window.electronAPI.saveFlow(updatedFlow)
    const { savedFlows } = get()
    const exists = savedFlows.some((f) => f.id === updatedFlow.id)
    const newSavedFlows = exists
      ? savedFlows.map((f) => (f.id === updatedFlow.id ? updatedFlow : f))
      : [updatedFlow, ...savedFlows]
    set({ savedFlows: newSavedFlows, isModified: false })
  },

  // ── Utility ──────────────────────────────────────────────────────────────────

  setSavedFlows: (flows) => set({ savedFlows: flows }),
  setHasApiKey:  (val)   => set({ hasApiKey: val }),
  markSaved:     ()      => set({ isModified: false }),
}))
