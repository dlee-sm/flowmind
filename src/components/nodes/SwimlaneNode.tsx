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
          background: colors.lightPurple,
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
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.lane ?? 'Lane'}
        </span>
        {hovered && (
          <button
            onClick={(e) => { e.stopPropagation(); deleteNode(id) }}
            style={deleteBtnInline}
            title="Delete node"
          >
            ×
          </button>
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
