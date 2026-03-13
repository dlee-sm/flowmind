import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type Node,
  BackgroundVariant,
} from 'reactflow'
import dagre from 'dagre'
import 'reactflow/dist/style.css'
import { useFlowStore } from '../store/useFlowStore'
import { nodeTypes } from './nodes'
import { CanvasContext } from './CanvasContext'
import ExportModal from './ExportModal'
import type { FlowData, NodeType, DiagramType } from '../types'
import { DIAGRAM_TYPE_LABELS, DIAGRAM_TYPE_ICONS } from '../types'
import { colors, shadows, radii } from '../styles/theme'

// ── Converters ────────────────────────────────────────────────────────────────

function toRFNodes(flowNodes: FlowData['nodes']): Node[] {
  return flowNodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: { label: n.label, lane: n.lane },
  }))
}

function toRFEdges(flowEdges: FlowData['edges']): Edge[] {
  return flowEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
  }))
}

function toFlowNode(n: Node): FlowData['nodes'][number] {
  return {
    id: n.id,
    type: n.type as NodeType,
    label: (n.data as { label: string }).label,
    position: n.position,
    lane: (n.data as { lane?: string }).lane,
  }
}

function toFlowEdge(e: Edge): FlowData['edges'][number] {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label as string | undefined,
  }
}

// ── Dagre auto-layout ─────────────────────────────────────────────────────────

function runDagre(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 60 })
  nodes.forEach((n) => g.setNode(n.id, { width: 160, height: 60 }))
  edges.forEach((e) => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return nodes.map((n) => {
    const { x, y } = g.node(n.id)
    return { ...n, position: { x: x - 80, y: y - 30 } }
  })
}

// ── Toolbar (inside ReactFlow so useReactFlow() works) ────────────────────────

interface ToolbarProps {
  title: string
  editingTitle: boolean
  isDirty: boolean
  diagramType: DiagramType | undefined
  canUndo: boolean
  canRedo: boolean
  onHome: () => void
  onTitleChange: (v: string) => void
  onTitleSave: () => void
  onTitleEdit: () => void
  onAddNode: (type: string) => void
  onAutoLayout: () => void
  onUndo: () => void
  onRedo: () => void
  onExport: () => void
}

function Toolbar(props: ToolbarProps) {
  const { fitView } = useReactFlow()
  const [addValue, setAddValue] = useState('')

  return (
    <Panel position="top-center" style={{ margin: '14px 0 0' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'rgba(255,255,255,0.90)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: `1px solid ${colors.borderGray}`,
          borderRadius: radii.lg,
          padding: '7px 14px',
          boxShadow: shadows.glass,
          fontFamily: "'Inter', sans-serif",
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
      >
        {/* ← Home breadcrumb */}
        <button onClick={props.onHome} style={btnStyle}>
          ← Home
        </button>
        <Sep />

        {/* Flow title — double-click to edit */}
        {props.editingTitle ? (
          <input
            autoFocus
            value={props.title}
            onChange={(e) => props.onTitleChange(e.target.value)}
            onBlur={props.onTitleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') props.onTitleSave()
            }}
            style={{
              border: `1px solid ${colors.primaryPurple}`,
              borderRadius: radii.sm,
              padding: '3px 8px',
              fontSize: 13,
              fontWeight: 600,
              color: colors.darkText,
              outline: 'none',
              fontFamily: "'Inter', sans-serif",
              minWidth: 120,
              maxWidth: 200,
            }}
          />
        ) : (
          <button
            onDoubleClick={props.onTitleEdit}
            title="Double-click to rename"
            style={{
              ...btnStyle,
              fontWeight: 600,
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {props.title}
            {props.isDirty && (
              <span style={{ color: colors.warningOrange, marginLeft: 4 }}>●</span>
            )}
          </button>
        )}

        {/* Diagram type badge */}
        {props.diagramType && (
          <>
            <Sep />
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: colors.primaryPurple,
                background: colors.lightPurple,
                borderRadius: radii.pill,
                padding: '3px 10px',
                letterSpacing: '0.02em',
              }}
            >
              {DIAGRAM_TYPE_ICONS[props.diagramType]}{' '}
              {DIAGRAM_TYPE_LABELS[props.diagramType]}
            </span>
          </>
        )}

        <Sep />

        {/* Add Node dropdown */}
        <select
          value={addValue}
          onChange={(e) => {
            if (e.target.value) {
              props.onAddNode(e.target.value)
              setAddValue('')
            }
          }}
          style={{ ...btnStyle, paddingRight: 2 }}
          title="Add a node"
        >
          <option value="" disabled>+ Node</option>
          <option value="process">Process</option>
          <option value="decision">Decision</option>
          <option value="startEnd">Start / End</option>
        </select>

        {/* Auto Layout */}
        <button onClick={props.onAutoLayout} style={btnStyle} title="Auto-arrange nodes">
          ⊞ Layout
        </button>

        {/* Zoom Fit */}
        <button
          onClick={() => fitView({ padding: 0.12, duration: 300 })}
          style={btnStyle}
          title="Fit all nodes in view"
        >
          ⤢ Fit
        </button>

        <Sep />

        {/* Undo */}
        <button
          onClick={props.onUndo}
          disabled={!props.canUndo}
          style={{ ...btnStyle, opacity: props.canUndo ? 1 : 0.35, display: 'flex', alignItems: 'center', gap: 4 }}
          title="Undo (⌘Z / Ctrl+Z)"
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>↩</span> Undo
        </button>

        {/* Redo */}
        <button
          onClick={props.onRedo}
          disabled={!props.canRedo}
          style={{ ...btnStyle, opacity: props.canRedo ? 1 : 0.35, display: 'flex', alignItems: 'center', gap: 4 }}
          title="Redo (⌘⇧Z / Ctrl+Shift+Z)"
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>↪</span> Redo
        </button>

        <Sep />

        {/* Export */}
        <button
          onClick={props.onExport}
          style={{
            ...btnStyle,
            background: colors.primaryPurple,
            color: colors.white,
            borderRadius: radii.md,
            padding: '5px 14px',
            fontWeight: 600,
          }}
        >
          Export
        </button>
      </div>
    </Panel>
  )
}

function Sep() {
  return (
    <div
      style={{
        width: 1,
        height: 18,
        background: colors.borderGray,
        flexShrink: 0,
        margin: '0 4px',
      }}
    />
  )
}

// ── Canvas ────────────────────────────────────────────────────────────────────

export default function Canvas() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    currentFlow,
    setTitle,
    isModified,
    markSaved,
    aiInsightReason,
    history,
    historyIndex,
    pushHistory,
    undo,
    redo,
  } = useFlowStore()

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [titleDraft, setTitleDraft] = useState('Untitled Flow')
  const [editingTitle, setEditingTitle] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [toast, setToast] = useState('')
  const canvasRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Flags for preventing history re-push during restoration
  const isRestoringRef = useRef(false)
  const undoRedoRef = useRef(false)
  // Prevents double history push when Delete key removes a node + its edges simultaneously
  const nodeRemovalInProgressRef = useRef(false)
  // Track previously seen flow ID to detect flow switches
  const prevFlowIdRef = useRef<string | null>(null)

  // Always-fresh refs for use inside stable callbacks
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  nodesRef.current = nodes
  edgesRef.current = edges

  // ── Initial load / flow switch ─────────────────────────────────────────────
  useEffect(() => {
    if (!currentFlow || currentFlow.id === prevFlowIdRef.current) return
    prevFlowIdRef.current = currentFlow.id
    isRestoringRef.current = true
    setNodes(toRFNodes(currentFlow.nodes))
    setEdges(toRFEdges(currentFlow.edges))
    setTitleDraft(currentFlow.title)
    setIsDirty(false)
    setTimeout(() => { isRestoringRef.current = false }, 60)

    if (currentFlow.nodes.length > 0) {
      setToast(aiInsightReason || `Diagram type: ${currentFlow.diagramType}`)
      setTimeout(() => setToast(''), 5000)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFlow?.id]) // intentionally narrow — only trigger on flow switch

  // ── Undo / redo sync: restore RF state from store ─────────────────────────
  useEffect(() => {
    if (!currentFlow || !undoRedoRef.current) return
    undoRedoRef.current = false
    isRestoringRef.current = true
    setNodes(toRFNodes(currentFlow.nodes))
    setEdges(toRFEdges(currentFlow.edges))
    setTimeout(() => { isRestoringRef.current = false }, 60)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyIndex]) // runs when undo/redo changes the index

  // ── History push on new edge connect ─────────────────────────────────────
  const prevEdgeCountRef = useRef(0)
  useEffect(() => {
    if (isRestoringRef.current) {
      prevEdgeCountRef.current = edges.length
      return
    }
    if (prevEdgeCountRef.current > 0 && edges.length > prevEdgeCountRef.current) {
      pushHistory(nodesRef.current.map(toFlowNode), edgesRef.current.map(toFlowEdge))
      setIsDirty(true)
    }
    prevEdgeCountRef.current = edges.length
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges.length])

  // ── Auto-save: debounced 500ms ─────────────────────────────────────────────
  useEffect(() => {
    if (!currentFlow || (!isDirty && !isModified)) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const flow: FlowData = {
        ...currentFlow,
        id: id ?? currentFlow.id,
        title: titleDraft,
        nodes: nodes.map(toFlowNode),
        edges: edges.map(toFlowEdge),
        updatedAt: new Date().toISOString(),
      }
      await window.electronAPI.saveFlow(flow)
      markSaved()
      setIsDirty(false)
    }, 500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [nodes, edges, isDirty, isModified, currentFlow?.id, titleDraft, id, markSaved])

  // ── Keyboard shortcuts: ⌘Z / ⌘⇧Z ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undoRedoRef.current = true
        undo()
      } else if (e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        undoRedoRef.current = true
        redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  // ── Edge connect ──────────────────────────────────────────────────────────
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  // ── Node changes: capture Delete key removals ────────────────────────────
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes)
      const removals = changes.filter((c): c is { type: 'remove'; id: string } =>
        c.type === 'remove'
      )
      if (removals.length > 0 && !isRestoringRef.current) {
        nodeRemovalInProgressRef.current = true
        const removedIds = new Set(removals.map((c) => c.id))
        const newNodes = nodesRef.current.filter((n) => !removedIds.has(n.id))
        // Also strip any edges that were connected to the deleted nodes
        const newEdges = edgesRef.current.filter(
          (e) => !removedIds.has(e.source) && !removedIds.has(e.target)
        )
        pushHistory(newNodes.map(toFlowNode), newEdges.map(toFlowEdge))
        setIsDirty(true)
        // Reset after the synchronous edge-change cascade has fired
        queueMicrotask(() => { nodeRemovalInProgressRef.current = false })
      }
    },
    [onNodesChange, pushHistory]
  )

  // ── Edge changes: capture Delete key removals ─────────────────────────────
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes)
      const removals = changes.filter((c): c is { type: 'remove'; id: string } =>
        c.type === 'remove'
      )
      // Skip if a node deletion already pushed the history snapshot (edge cascade)
      if (removals.length > 0 && !isRestoringRef.current && !nodeRemovalInProgressRef.current) {
        const removedIds = new Set(removals.map((c) => c.id))
        const newEdges = edgesRef.current.filter((e) => !removedIds.has(e.id))
        pushHistory(nodesRef.current.map(toFlowNode), newEdges.map(toFlowEdge))
        setIsDirty(true)
      }
    },
    [onEdgesChange, pushHistory]
  )

  // ── Node drag stop: push snapshot to history ──────────────────────────────
  const onNodeDragStop = useCallback(
    (_e: React.MouseEvent, _n: Node) => {
      if (!isRestoringRef.current) {
        pushHistory(nodesRef.current.map(toFlowNode), edgesRef.current.map(toFlowEdge))
        setIsDirty(true)
      }
    },
    [pushHistory]
  )

  // ── Auto Layout ───────────────────────────────────────────────────────────
  const handleAutoLayout = useCallback(() => {
    setNodes((nds) => {
      const laid = runDagre(nds, edgesRef.current)
      pushHistory(laid.map(toFlowNode), edgesRef.current.map(toFlowEdge))
      setIsDirty(true)
      return laid
    })
  }, [setNodes, pushHistory])

  // ── Add Node ──────────────────────────────────────────────────────────────
  const addNode = useCallback(
    (type: string) => {
      const newNode: Node = {
        id: crypto.randomUUID(),
        type,
        position: { x: Math.random() * 300 + 150, y: Math.random() * 200 + 100 },
        data: { label: type.charAt(0).toUpperCase() + type.slice(1) },
      }
      setNodes((nds) => {
        const updated = [...nds, newNode]
        pushHistory(updated.map(toFlowNode), edgesRef.current.map(toFlowEdge))
        setIsDirty(true)
        return updated
      })
    },
    [setNodes, pushHistory]
  )

  // ── Delete Node ───────────────────────────────────────────────────────────
  const deleteNode = useCallback(
    (nodeId: string) => {
      const newNodes = nodesRef.current.filter((n) => n.id !== nodeId)
      const newEdges = edgesRef.current.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      )
      setNodes(newNodes)
      setEdges(newEdges)
      pushHistory(newNodes.map(toFlowNode), newEdges.map(toFlowEdge))
      setIsDirty(true)
    },
    [setNodes, setEdges, pushHistory]
  )

  // ── Title save ────────────────────────────────────────────────────────────
  const handleTitleSave = useCallback(() => {
    setTitle(titleDraft)  // marks isModified in store
    setEditingTitle(false)
  }, [titleDraft, setTitle])

  // ── Undo / redo buttons ───────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    undoRedoRef.current = true
    undo()
  }, [undo])

  const handleRedo = useCallback(() => {
    undoRedoRef.current = true
    redo()
  }, [redo])

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  return (
    <CanvasContext.Provider value={{ deleteNode }}>
    <>
    <div
      ref={canvasRef}
      style={{ width: '100vw', height: '100vh', fontFamily: "'Inter', sans-serif" }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode={['Delete', 'Backspace']}
      >
        {/* Dot-grid background */}
        <Background
          color={colors.lightPurple}
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
        />

        {/* Controls (zoom in/out/reset) — bottom-left by default */}
        <Controls />

        {/* Mini-map — bottom-right */}
        <MiniMap
          position="bottom-right"
          nodeColor={(n) => {
            const map: Record<string, string> = {
              process:  colors.primaryPurple,
              decision: colors.warningOrange,
              startEnd: colors.tealAccent,
              swimlane: colors.borderGray,
              mindmap:  colors.lightPurple,
            }
            return map[n.type ?? ''] ?? colors.borderGray
          }}
          style={{ borderRadius: radii.md }}
        />

        {/* Glass-morphism floating toolbar */}
        <Toolbar
          title={titleDraft}
          editingTitle={editingTitle}
          isDirty={isDirty || isModified}
          diagramType={currentFlow?.diagramType}
          canUndo={canUndo}
          canRedo={canRedo}
          onHome={() => navigate('/')}
          onTitleChange={setTitleDraft}
          onTitleSave={handleTitleSave}
          onTitleEdit={() => setEditingTitle(true)}
          onAddNode={addNode}
          onAutoLayout={handleAutoLayout}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onExport={() => setShowExport(true)}
        />

        {/* AI Insight toast — fades out after 5 s */}
        {toast && (
          <Panel position="top-center" style={{ marginTop: 76, pointerEvents: 'none' }}>
            <div
              style={{
                background: colors.primaryPurple,
                color: colors.white,
                borderRadius: radii.md,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 500,
                boxShadow: shadows.lg,
                maxWidth: 500,
                textAlign: 'center',
              }}
            >
              ✨ {toast}
            </div>
          </Panel>
        )}
      </ReactFlow>

    </div>

    {/* ExportModal is outside canvasRef so html2canvas doesn't capture the overlay */}
    {showExport && (
      <ExportModal
        title={titleDraft}
        canvasRef={canvasRef}
        onClose={() => setShowExport(false)}
      />
    )}
    </>
    </CanvasContext.Provider>
  )
}

// ── Shared button style ───────────────────────────────────────────────────────

const btnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 13,
  color: colors.darkText,
  cursor: 'pointer',
  fontFamily: "'Inter', sans-serif",
  fontWeight: 500,
  padding: '4px 8px',
  borderRadius: radii.sm,
}
