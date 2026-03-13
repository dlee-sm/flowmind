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
      onDoubleClick={startEdit}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: colors.primaryPurple,
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
          ? `0 6px 18px rgba(91,45,142,0.38)${selected ? `, 0 0 0 2.5px ${colors.tealAccent}` : ''}`
          : '0 2px 6px rgba(0,0,0,0.13)',
        transition: 'box-shadow 0.18s, border-color 0.18s',
        userSelect: 'none',
      }}
    >
      {hovered && !editing && (
        <button
          onClick={(e) => { e.stopPropagation(); deleteNode(id) }}
          style={deleteBtn}
          title="Delete node"
        >
          ×
        </button>
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
