import { useEffect, useState } from 'react'
import { captureCanvas, exportToPNG, exportToPDF, exportToSVG } from '../services/export'
import type { ExportFormat } from '../types'
import { colors, radii } from '../styles/theme'

interface ExportModalProps {
  title: string
  canvasRef: React.RefObject<HTMLDivElement>
  onClose: () => void
}

const FORMATS: { id: ExportFormat; label: string; desc: string; color: string }[] = [
  { id: 'png', label: 'PNG', desc: 'Image · 2×',    color: colors.tealAccent    },
  { id: 'pdf', label: 'PDF', desc: 'A4 landscape',  color: colors.primaryPurple },
  { id: 'svg', label: 'SVG', desc: 'Vector',         color: colors.darkText      },
]

export default function ExportModal({ title, canvasRef, onClose }: ExportModalProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [filename, setFilename] = useState(
    `${title.replace(/\s+/g, '-').toLowerCase()}-${today}`,
  )
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Capture a low-res thumbnail of the canvas on mount
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    let cancelled = false
    captureCanvas(el, 0.35)
      .then((c) => { if (!cancelled) setPreviewUrl(c.toDataURL('image/png')) })
      .catch(() => {/* preview failure is non-fatal */})
    return () => { cancelled = true }
  }, [canvasRef])

  const doExport = async (fmt: ExportFormat) => {
    const el = canvasRef.current
    if (!el || exporting) return
    setExporting(fmt)
    try {
      if (fmt === 'png') await exportToPNG(el, filename)
      else if (fmt === 'pdf') await exportToPDF(el, filename, title)
      else exportToSVG(el, filename)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        fontFamily: "'Inter', sans-serif",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: colors.white,
          borderRadius: radii.xl,
          padding: 32,
          width: 460,
          boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
        }}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: colors.darkText }}>
            Export "{title}"
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 18,
              cursor: 'pointer',
              color: '#aaa',
              lineHeight: 1,
              padding: 4,
              borderRadius: radii.sm,
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Canvas preview thumbnail ──────────────────────────────────── */}
        <div
          style={{
            width: '100%',
            height: 156,
            background: colors.lightPurple,
            borderRadius: radii.md,
            marginBottom: 20,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${colors.borderGray}`,
          }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Canvas preview"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <span style={{ fontSize: 12, color: '#b0a8c8', fontStyle: 'italic' }}>
              Generating preview…
            </span>
          )}
        </div>

        {/* ── Filename input ────────────────────────────────────────────── */}
        <label
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#888',
            display: 'block',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Filename
        </label>
        <input
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          spellCheck={false}
          style={{
            width: '100%',
            border: `1.5px solid ${colors.borderGray}`,
            borderRadius: radii.md,
            padding: '9px 12px',
            fontSize: 13,
            marginBottom: 24,
            boxSizing: 'border-box',
            fontFamily: "'Inter', sans-serif",
            color: colors.darkText,
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = colors.primaryPurple)}
          onBlur={(e)  => (e.currentTarget.style.borderColor = colors.borderGray)}
        />

        {/* ── Export buttons ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10 }}>
          {FORMATS.map(({ id, label, desc, color }) => {
            const loading = exporting === id
            return (
              <button
                key={id}
                onClick={() => doExport(id)}
                disabled={!!exporting}
                style={{
                  flex: 1,
                  background: color,
                  color: colors.white,
                  border: 'none',
                  borderRadius: radii.md,
                  padding: '13px 8px',
                  cursor: exporting ? (loading ? 'wait' : 'default') : 'pointer',
                  opacity: exporting && !loading ? 0.5 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'opacity 0.15s, transform 0.12s',
                  fontFamily: "'Inter', sans-serif",
                }}
                onMouseEnter={(e) => {
                  if (!exporting)
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.transform = 'none'
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}>
                  {loading ? '⏳' : label}
                </span>
                <span style={{ fontSize: 10, opacity: 0.82 }}>
                  {loading ? 'Exporting…' : desc}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
