import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFlowStore } from '../store/useFlowStore'
import type { FlowData } from '../types'
import { DIAGRAM_TYPE_ICONS, DIAGRAM_TYPE_LABELS } from '../types'
import { colors, shadows, radii } from '../styles/theme'

export default function Home() {
  const navigate = useNavigate()
  const { savedFlows, setSavedFlows, loadFlow, newFlow, hasApiKey } = useFlowStore()
  const [loading, setLoading] = useState(true)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI.loadFlows().then((flows) => {
      setSavedFlows(flows)
      setLoading(false)
    })
  }, [setSavedFlows])

  const handleNewFlow = () => {
    newFlow({})
    navigate('/record')
  }

  const handleEdit = (flow: FlowData) => {
    loadFlow(flow)
    navigate(`/canvas/${flow.id}`)
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingId(id)
    await window.electronAPI.deleteFlow(id)
    setSavedFlows(savedFlows.filter((f) => f.id !== id))
    setDeletingId(null)
  }

  return (
    <div
      style={{
        padding: '32px 40px',
        maxWidth: 1100,
        margin: '0 auto',
        minHeight: '100vh',
        fontFamily: 'var(--font-family)',
      }}
    >
      {/* ── API key banner ──────────────────────────────────────────────────── */}
      {!hasApiKey && (
        <div
          className="alert alert-warning fade-in"
          onClick={() => navigate('/settings')}
          role="button"
          style={{
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span>⚠️ Add your Anthropic API key in Settings to get started</span>
          <span style={{ color: colors.primaryPurple, fontWeight: 700, whiteSpace: 'nowrap' }}>
            Settings →
          </span>
        </div>
      )}

      {/* ── Actions row ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 28,
        }}
      >
        <button
          className="btn btn-primary btn-lg"
          onClick={handleNewFlow}
          style={{ gap: 10 }}
        >
          <span style={{ fontSize: 20, lineHeight: 1, marginTop: -1 }}>＋</span>
          New Flow
        </button>

        {savedFlows.length > 0 && (
          <span style={{ fontSize: 13, color: '#999' }}>
            {savedFlows.length} flow{savedFlows.length !== 1 ? 's' : ''} saved
          </span>
        )}
      </div>

      {/* ── Content area ───────────────────────────────────────────────────── */}
      {loading ? (
        <LoadingSkeleton />
      ) : savedFlows.length === 0 ? (
        <EmptyState onNewFlow={handleNewFlow} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 20,
          }}
        >
          {savedFlows.map((flow) => (
            <FlowCard
              key={flow.id}
              flow={flow}
              isHovered={hoveredId === flow.id}
              isDeleting={deletingId === flow.id}
              onMouseEnter={() => setHoveredId(flow.id)}
              onMouseLeave={() => setHoveredId(null)}
              onEdit={() => handleEdit(flow)}
              onDelete={(e) => handleDelete(flow.id, e)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── FlowCard ─────────────────────────────────────────────────────────────────

interface FlowCardProps {
  flow: FlowData
  isHovered: boolean
  isDeleting: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onEdit: () => void
  onDelete: (e: React.MouseEvent) => void
}

function FlowCard({
  flow,
  isHovered,
  isDeleting,
  onMouseEnter,
  onMouseLeave,
  onEdit,
  onDelete,
}: FlowCardProps) {
  return (
    <div
      onClick={onEdit}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        background: colors.white,
        border: `1px solid ${isHovered ? colors.primaryPurple : colors.borderGray}`,
        borderRadius: radii.lg,
        padding: '20px 20px 0',
        cursor: 'pointer',
        transition: 'box-shadow 0.18s, border-color 0.18s',
        boxShadow: isHovered ? shadows.hover : shadows.card,
        overflow: 'hidden',
      }}
    >
      {/* Card body */}
      <div style={{ paddingBottom: 16 }}>
        {/* Diagram type badge */}
        <div style={{ marginBottom: 10 }}>
          <span className="badge badge-primary">
            {DIAGRAM_TYPE_ICONS[flow.diagramType]}&nbsp;
            {DIAGRAM_TYPE_LABELS[flow.diagramType]}
          </span>
        </div>

        {/* Title */}
        <div
          className="truncate"
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: colors.darkText,
            marginBottom: 6,
            lineHeight: 1.3,
          }}
        >
          {flow.title}
        </div>

        {/* Last modified */}
        <div style={{ fontSize: 11, color: '#999' }}>
          Updated{' '}
          {new Date(flow.updatedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>
      </div>

      {/* Hover action bar — always in DOM so no layout shift; fades in on hover */}
      <div
        style={{
          borderTop: `1px solid ${colors.borderGray}`,
          display: 'flex',
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.15s',
          pointerEvents: isHovered ? 'auto' : 'none',
        }}
      >
        <ActionBtn
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          color={colors.primaryPurple}
        >
          ✏️ Edit
        </ActionBtn>

        <div
          style={{ width: 1, background: colors.borderGray, margin: '5px 0' }}
        />

        <ActionBtn
          onClick={onDelete}
          color={isDeleting ? '#ccc' : colors.errorRed}
          disabled={isDeleting}
        >
          {isDeleting ? '…' : '🗑️ Delete'}
        </ActionBtn>
      </div>
    </div>
  )
}

// ─── ActionBtn ────────────────────────────────────────────────────────────────

interface ActionBtnProps {
  onClick: (e: React.MouseEvent) => void
  color: string
  disabled?: boolean
  children: React.ReactNode
}

function ActionBtn({ onClick, color, disabled = false, children }: ActionBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        padding: '9px 0',
        fontSize: 12,
        fontWeight: 600,
        color,
        background: 'none',
        border: 'none',
        cursor: disabled ? 'wait' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        fontFamily: 'var(--font-family)',
      }}
    >
      {children}
    </button>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ onNewFlow }: { onNewFlow: () => void }) {
  return (
    <div
      className="fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 80,
        paddingBottom: 80,
      }}
    >
      {/* Simple flowchart illustration */}
      <div
        style={{
          marginBottom: 28,
          position: 'relative',
          width: 140,
          height: 130,
        }}
      >
        <FlowIllustration />
      </div>

      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: colors.darkText,
          marginBottom: 8,
          textAlign: 'center',
        }}
      >
        Record your first workflow
      </h2>
      <p
        style={{
          fontSize: 14,
          color: '#888',
          marginBottom: 28,
          textAlign: 'center',
          maxWidth: 320,
          lineHeight: 1.6,
        }}
      >
        Speak naturally about how you work. FlowMind will turn it into a
        visual diagram in seconds.
      </p>

      <button
        className="btn btn-primary btn-lg"
        onClick={onNewFlow}
        style={{ gap: 10 }}
      >
        <span style={{ fontSize: 18 }}>🎤</span>
        Start Recording
      </button>
    </div>
  )
}

// ─── FlowIllustration — inline SVG placeholder ────────────────────────────────

function FlowIllustration() {
  return (
    <svg
      width="140"
      height="130"
      viewBox="0 0 140 130"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Start node */}
      <rect x="40" y="4" width="60" height="24" rx="12" fill={colors.tealAccent} opacity="0.9" />
      <text x="70" y="20" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="600" fontFamily="Inter,sans-serif">Start</text>

      {/* Arrow down */}
      <line x1="70" y1="28" x2="70" y2="44" stroke={colors.borderGray} strokeWidth="2" />
      <polygon points="65,40 70,48 75,40" fill={colors.borderGray} />

      {/* Process node */}
      <rect x="26" y="48" width="88" height="24" rx="6" fill={colors.primaryPurple} opacity="0.9" />
      <text x="70" y="64" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="600" fontFamily="Inter,sans-serif">Process Step</text>

      {/* Arrow down */}
      <line x1="70" y1="72" x2="70" y2="80" stroke={colors.borderGray} strokeWidth="2" />
      <polygon points="65,76 70,84 75,76" fill={colors.borderGray} />

      {/* Decision diamond */}
      <polygon points="70,84 100,100 70,116 40,100" fill={colors.warningOrange} opacity="0.85" />
      <text x="70" y="104" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="600" fontFamily="Inter,sans-serif">Decision?</text>

      {/* Yes / No labels */}
      <text x="108" y="103" fill="#999" fontSize="9" fontFamily="Inter,sans-serif">Yes</text>
      <text x="20" y="103" fill="#999" fontSize="9" fontFamily="Inter,sans-serif">No</text>

      {/* Side arrows from diamond */}
      <line x1="100" y1="100" x2="124" y2="100" stroke={colors.borderGray} strokeWidth="1.5" />
      <line x1="40" y1="100" x2="16" y2="100" stroke={colors.borderGray} strokeWidth="1.5" />
    </svg>
  )
}

// ─── LoadingSkeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 20,
      }}
    >
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            background: colors.white,
            border: `1px solid ${colors.borderGray}`,
            borderRadius: radii.lg,
            padding: 20,
            height: 120,
          }}
        >
          <div
            style={{
              background: colors.lightPurple,
              borderRadius: radii.pill,
              height: 20,
              width: 100,
              marginBottom: 14,
              opacity: 0.5,
            }}
          />
          <div
            style={{
              background: colors.lightPurple,
              borderRadius: radii.sm,
              height: 14,
              width: '75%',
              marginBottom: 10,
              opacity: 0.3,
            }}
          />
          <div
            style={{
              background: colors.lightPurple,
              borderRadius: radii.sm,
              height: 11,
              width: '45%',
              opacity: 0.2,
            }}
          />
        </div>
      ))}
    </div>
  )
}
