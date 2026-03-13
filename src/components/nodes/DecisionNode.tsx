import { useState, useCallback, useContext } from 'react'
import { Handle, Position, type NodeProps, useReactFlow } from 'reactflow'
import type { NodeData } from '../../types'
import { colors } from '../../styles/theme'
import { CanvasContext } from '../CanvasContext'

// Container is 110×110. The inner rotated square is 76×76.
// At 45°, its diagonal = 76√2 ≈ 107 — vertices nearly reach container edges,
// so React Flow's default handle positions (Top/Bottom/Right/Left midpoints)
// align cleanly with the diamond's four vertices.
const SIZE = 110
const DIAMOND = 76

export default function DecisionNode({ id, data, selected }: NodeProps<NodeData>) {
  const { setNodes } = useReactFlow()
  const { deleteNode } = useContext(CanvasContext)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.label)
  const [hovered, setHovered] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)

  const nodeColor = data.color || colors.warningOrange

  const startEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setDraft(data.label)
    setEditing(true)
  }, [data.label])

  const confirmEdit = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) => n.id === id ? { ...n, data: { ...n.data, label: draft } } : n)
    )
    setEditing(false)
  }, [id, draft, setNodes])

  const cancelEdit = useCallback(() => setEditing(false), [])

  const changeColor = useCallback((color: string) => {
    setNodes((nds) =>
      nds.map((n) => n.id === id ? { ...n, data: { ...n.data, color } } : n)
    )
    setShowColorPicker(false)
  }, [id, setNodes])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation()
      if (e.key === 'Enter') confirmEdit()
      else if (e.key === 'Escape') cancelEdit()
    },
    [confirmEdit, cancelEdit]
  )

  // box-shadow on a rotated element also rotates — giving a diamond-shaped ring
  const diamondShadow = selected
    ? `0 0 0 2.5px ${colors.tealAccent}, 0 ${hovered ? 8 : 2}px ${hovered ? 20 : 8}px rgba(243,156,18,${hovered ? 0.42 : 0.18})`
    : hovered
      ? '0 8px 20px rgba(243,156,18,0.38)'
      : '0 2px 8px rgba(0,0,0,0.14)'

  return (
    <div
      onDoubleClick={startEdit}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: SIZE,
        height: SIZE,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: editing ? 'text' : 'grab',
        userSelect: 'none',
      }}
    >
      {hovered && !editing && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker) }}
            style={colorBtn}
            title="Change color"
          >
            🎨
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); deleteNode(id) }}
            style={deleteBtn}
            title="Delete node"
          >
            ×
          </button>
        </>
      )}
      {showColorPicker && (
        <div style={colorPickerContainer} onClick={(e) => e.stopPropagation()}>
          {[colors.primaryPurple, colors.tealAccent, colors.warningOrange, colors.successGreen, '#3b82f6', '#ec4899', '#8b5cf6', '#10b981'].map((c) => (
            <button
              key={c}
              onClick={() => changeColor(c)}
              style={{ ...colorSwatch, background: c }}
              title={c}
            />
          ))}
        </div>
      )}
      {/* Rotated square — the actual diamond shape */}
      <div
        style={{
          position: 'absolute',
          width: DIAMOND,
          height: DIAMOND,
          background: nodeColor,
          transform: 'rotate(45deg)',
          boxShadow: diamondShadow,
          transition: 'box-shadow 0.18s',
        }}
      />

      {/* Label — sits above the diamond in z-order */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          color: colors.white,
          fontFamily: 'var(--font-family)',
          fontSize: 11,
          fontWeight: 600,
          textAlign: 'center',
          maxWidth: DIAMOND - 8,
          lineHeight: 1.35,
        }}
      >
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={confirmEdit}
            style={{
              background: 'transparent',
              border: 'none',
              color: colors.white,
              textAlign: 'center',
              fontFamily: 'var(--font-family)',
              fontSize: 11,
              fontWeight: 600,
              width: DIAMOND - 16,
              outline: 'none',
            }}
          />
        ) : (
          <span style={{ wordBreak: 'break-word' }}>{data.label}</span>
        )}
      </div>

      {/* Handles at diamond vertices */}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} id="yes" />
      <Handle type="source" position={Position.Right} id="no" />
      <Handle type="source" position={Position.Left} id="alt" />
    </div>
  )
}

const colorBtn: React.CSSProperties = {
  position: 'absolute',
  top: -8,
  right: 16,
  width: 20,
  height: 20,
  borderRadius: '50%',
  background: '#fff',
  color: '#333',
  border: '1px solid #ddd',
  cursor: 'pointer',
  fontSize: 11,
  lineHeight: '20px',
  textAlign: 'center',
  boxShadow: '0 2px 6px rgba(0,0,0,0.28)',
  zIndex: 10,
  padding: 0,
}

const deleteBtn: React.CSSProperties = {
  position: 'absolute',
  top: -8,
  right: -8,
  width: 20,
  height: 20,
  borderRadius: '50%',
  background: '#e53e3e',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontSize: 14,
  lineHeight: '20px',
  textAlign: 'center',
  fontWeight: 700,
  boxShadow: '0 2px 6px rgba(0,0,0,0.28)',
  zIndex: 10,
  padding: 0,
}

const colorPickerContainer: React.CSSProperties = {
  position: 'absolute',
  top: -50,
  right: -8,
  background: '#fff',
  borderRadius: 8,
  padding: 8,
  display: 'flex',
  gap: 6,
  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
  zIndex: 20,
}

const colorSwatch: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 4,
  border: '2px solid #fff',
  cursor: 'pointer',
  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  transition: 'transform 0.1s',
}
