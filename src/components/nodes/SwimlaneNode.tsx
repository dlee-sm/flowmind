import { useState, useCallback, useContext } from 'react'
import { Handle, Position, type NodeProps, useReactFlow } from 'reactflow'
import type { NodeData } from '../../types'
import { colors } from '../../styles/theme'
import { CanvasContext } from '../CanvasContext'

export default function SwimlaneNode({ id, data, selected }: NodeProps<NodeData>) {
  const { setNodes } = useReactFlow()
  const { deleteNode } = useContext(CanvasContext)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.label)
  const [hovered, setHovered] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)

  const nodeColor = data.color || colors.lightPurple

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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        border: `2px solid ${selected ? colors.tealAccent : colors.borderGray}`,
        borderRadius: 8,
        overflow: 'hidden',
        minWidth: 180,
        fontFamily: 'var(--font-family)',
        boxShadow: hovered
          ? `0 6px 18px rgba(91,45,142,0.20)${selected ? `, 0 0 0 1px ${colors.tealAccent}` : ''}`
          : '0 2px 6px rgba(0,0,0,0.08)',
        transition: 'box-shadow 0.18s, border-color 0.18s',
        userSelect: 'none',
        background: colors.white,
      }}
    >
      {/* ── Lane header — shows the role/department name + delete button ── */}
      <div
        style={{
          background: nodeColor,
          borderBottom: `1px solid ${colors.borderGray}`,
          padding: '5px 12px',
          fontSize: 10,
          fontWeight: 700,
          color: colors.primaryPurple,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          position: 'relative',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.lane ?? 'Lane'}
        </span>
        {hovered && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker) }}
              style={colorBtnInline}
              title="Change color"
            >
              🎨
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); deleteNode(id) }}
              style={deleteBtnInline}
              title="Delete node"
            >
              ×
            </button>
          </div>
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
      </div>

      {/* ── Action label — double-click to edit ── */}
      <div
        onDoubleClick={startEdit}
        style={{
          padding: '10px 14px',
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          cursor: editing ? 'text' : 'grab',
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
              color: colors.darkText,
              fontFamily: 'var(--font-family)',
              fontSize: 12,
              fontWeight: 600,
              outline: 'none',
              width: '100%',
            }}
          />
        ) : (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: colors.darkText,
              lineHeight: 1.4,
              wordBreak: 'break-word',
            }}
          >
            {data.label}
          </span>
        )}
      </div>

      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <Handle type="source" position={Position.Right} id="right" />
    </div>
  )
}

const colorBtnInline: React.CSSProperties = {
  flexShrink: 0,
  width: 16,
  height: 16,
  borderRadius: '50%',
  background: '#fff',
  color: '#333',
  border: '1px solid #ddd',
  cursor: 'pointer',
  fontSize: 9,
  lineHeight: '16px',
  textAlign: 'center',
  boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
  padding: 0,
}

const deleteBtnInline: React.CSSProperties = {
  flexShrink: 0,
  width: 16,
  height: 16,
  borderRadius: '50%',
  background: '#e53e3e',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontSize: 12,
  lineHeight: '16px',
  textAlign: 'center',
  fontWeight: 700,
  boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
  padding: 0,
}

const colorPickerContainer: React.CSSProperties = {
  position: 'absolute',
  top: 30,
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
