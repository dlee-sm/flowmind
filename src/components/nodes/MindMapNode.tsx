import { useState, useCallback, useContext } from 'react'
import { Handle, Position, type NodeProps, useReactFlow } from 'reactflow'
import type { NodeData } from '../../types'
import { colors } from '../../styles/theme'
import { CanvasContext } from '../CanvasContext'

const SIZE = 104

export default function MindMapNode({ id, data, selected }: NodeProps<NodeData>) {
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
        background: colors.lightPurple,
        color: colors.darkText,
        border: `2.5px solid ${selected ? colors.tealAccent : 'transparent'}`,
        borderRadius: '50%',
        width: SIZE,
        height: SIZE,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        fontFamily: 'var(--font-family)',
        fontSize: 12,
        fontWeight: 600,
        cursor: editing ? 'text' : 'grab',
        boxShadow: hovered
          ? '0 6px 18px rgba(91,45,142,0.25)'
          : '0 2px 7px rgba(0,0,0,0.10)',
        transition: 'box-shadow 0.18s, border-color 0.18s',
        padding: 8,
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
      {/* All four cardinal handles so mind-map branches radiate in any direction */}
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />

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
            textAlign: 'center',
            fontFamily: 'var(--font-family)',
            fontSize: 12,
            fontWeight: 600,
            color: colors.darkText,
            width: SIZE - 24,
            outline: 'none',
          }}
        />
      ) : (
        <span style={{ wordBreak: 'break-word', lineHeight: 1.35 }}>{data.label}</span>
      )}
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
