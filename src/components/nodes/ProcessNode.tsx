import { useState, useCallback, useContext } from 'react'
import { Handle, Position, type NodeProps, useReactFlow } from 'reactflow'
import type { NodeData } from '../../types'
import { colors } from '../../styles/theme'
import { CanvasContext } from '../CanvasContext'

export default function ProcessNode({ id, data, selected }: NodeProps<NodeData>) {
  const { setNodes } = useReactFlow()
  const { deleteNode } = useContext(CanvasContext)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.label)
  const [hovered, setHovered] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)

  const nodeColor = data.color || colors.primaryPurple

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

  return (
    <div
      onDoubleClick={startEdit}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: nodeColor,
        color: colors.white,
        border: `2.5px solid ${selected ? colors.tealAccent : 'transparent'}`,
        borderRadius: 7,
        padding: '10px 18px',
        minWidth: 140,
        textAlign: 'center',
        fontFamily: 'var(--font-family)',
        fontSize: 13,
        fontWeight: 600,
        cursor: editing ? 'text' : 'grab',
        boxShadow: hovered
          ? `0 6px 18px ${nodeColor}66${selected ? `, 0 0 0 2.5px ${colors.tealAccent}` : ''}`
          : '0 2px 6px rgba(0,0,0,0.13)',
        transition: 'box-shadow 0.18s, border-color 0.18s',
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
      <Handle type="target" position={Position.Top} />
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
            fontSize: 13,
            fontWeight: 600,
            width: '100%',
            outline: 'none',
          }}
        />
      ) : (
        <span style={{ wordBreak: 'break-word', lineHeight: 1.4 }}>{data.label}</span>
      )}
      <Handle type="source" position={Position.Bottom} />
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
