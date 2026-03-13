import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { SpeechService } from '../services/speech'
import { sendTranscriptToClaude } from '../services/claude'
import { useFlowStore } from '../store/useFlowStore'
import type { DiagramType, WhisperProgress } from '../types'
import { DIAGRAM_TYPE_ICONS, DIAGRAM_TYPE_LABELS } from '../types'
import { colors } from '../styles/theme'

// Fixed per-bar amplitude multipliers — gives a natural-looking waveform shape
const BAR_MULTS = [0.35, 0.65, 0.95, 0.80, 0.55, 0.90, 0.45, 0.75, 0.60, 0.30]

type MicState = 'idle' | 'recording' | 'transcribing' | 'done'

// ── Keyword-based diagram type guesser ──────────────────────────────────────
// Used for the live preview badge while the user speaks. Claude makes the
// final authoritative decision; this is just a UX hint.
function guessType(text: string): DiagramType {
  const t = text.toLowerCase()
  if (/\b(department|team|role|responsible|handles|manages|assigned|owner|stakeholder|hand.?off|cross.?functional)\b/.test(t))
    return 'swimlane'
  if (/\b(brainstorm|idea|topic|concept|explore|mind.?map|relate|cluster)\b/.test(t))
    return 'mindmap'
  if (/\b(step|phase|first|second|third|then|next|finally|after|before|sequence|in order|sequentially)\b/.test(t))
    return 'linear'
  if (/\b(if|when|decision|branch|yes|no|approve|reject|check|verify|gate|review|depends)\b/.test(t))
    return 'flowchart'
  return 'flowchart'
}

// Rough node count estimate: ~1 node per 15 words, clamped to Claude's range
function estimateNodes(wordCount: number): number {
  if (wordCount < 15) return 0
  return Math.min(12, Math.max(4, Math.round(wordCount / 15)))
}

// ── Component ────────────────────────────────────────────────────────────────
export default function Record() {
  const navigate = useNavigate()
  const { newFlow } = useFlowStore()
  const [micState, setMicState]     = useState<MicState>('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError]           = useState('')
  const [generating, setGenerating] = useState(false)
  const [whisperProgress, setWhisperProgress] = useState<WhisperProgress | null>(null)
  const speechRef        = useRef<SpeechService | null>(null)
  const transcriptRef    = useRef('')
  const transcriptBoxRef = useRef<HTMLTextAreaElement>(null)
  // Direct DOM ref for audio-level bars — updated at ~30 FPS without React re-renders
  const barsRef          = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const svc = new SpeechService()
    speechRef.current = svc

    // Update bar heights directly on the DOM — avoids 30 FPS React re-renders
    svc.onLevel((rms) => {
      const bars = barsRef.current?.children
      if (!bars) return
      BAR_MULTS.forEach((m, i) => {
        const h = Math.max(3, Math.min(36, rms * 320 * m))
        ;(bars[i] as HTMLElement).style.height = `${h}px`
      })
    })

    return () => svc.destroy()
  }, [])

  // Pre-warm the Whisper worker and subscribe to download/load progress
  useEffect(() => {
    // initWhisper triggers the worker to start, which begins model download
    window.electronAPI.initWhisper().catch(() => {})

    const unsub = window.electronAPI.onWhisperProgress((p) => {
      // 'download' / 'progress' → show progress bar
      // 'ready' → model is loaded, hide bar after a brief moment
      if (p.status === 'ready' || p.type === 'ready') {
        setWhisperProgress(null)
      } else if (
        p.status === 'download' || p.status === 'progress' ||
        p.status === 'initiate' || p.status === 'loading'
      ) {
        setWhisperProgress(p)
      }
    })
    return unsub
  }, [])

  // Auto-scroll transcript box as live text grows
  useEffect(() => {
    const box = transcriptBoxRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [transcript])

  // ── Derived values ──────────────────────────────────────────────────────────
  const wordCount     = transcript.trim().split(/\s+/).filter(Boolean).length
  const guessedType   = guessType(transcript)
  const estNodes      = estimateNodes(wordCount)
  const canGenerate   = wordCount >= 10 && !generating

  // ── Recording helpers ───────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    const svc = speechRef.current
    if (!svc) return
    if (!svc.isSupported()) {
      setError('Speech recognition is not available. Please ensure microphone access is granted.')
      return
    }
    setError('')

    svc.onTranscript((text, isFinal) => {
      if (isFinal) {
        transcriptRef.current = (transcriptRef.current + ' ' + text).trim()
        setTranscript(transcriptRef.current)
      } else {
        setTranscript((transcriptRef.current + ' ' + text).trim())
      }
    })

    svc.onTranscribing(() => setMicState('transcribing'))

    svc.onEnd(() => setMicState('done'))

    svc.onError((msg) => {
      setError(msg)
      setMicState('idle')
    })

    svc.start()
    setMicState('recording')
  }, [])

  const handleMicClick = useCallback(() => {
    const svc = speechRef.current
    if (!svc) return

    if (micState === 'idle') {
      // Fresh session — clear previous transcript
      setTranscript('')
      transcriptRef.current = ''
      startRecording()
    } else if (micState === 'recording') {
      // Stop recording; onTranscribing callback will set state to 'transcribing'
      svc.stop()
    } else if (micState === 'transcribing') {
      // Busy — ignore clicks while Whisper is running
    } else {
      // done → continue appending to existing transcript
      startRecording()
    }
  }, [micState, startRecording])

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return
    setGenerating(true)
    setError('')
    try {
      const apiKey = (await window.electronAPI.getApiKey()) ?? ''
      const result = await sendTranscriptToClaude(transcript, apiKey)
      newFlow(
        { title: result.title, diagramType: result.diagramType, nodes: result.nodes, edges: result.edges },
        result.reason
      )
      // useFlowStore.getState() reads the latest synchronous Zustand state —
      // the UUID that newFlow() just assigned, so the URL matches the stored flow.
      const flowId = useFlowStore.getState().currentFlow?.id ?? crypto.randomUUID()
      navigate(`/canvas/${flowId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setGenerating(false)
    }
  }, [transcript, canGenerate, newFlow, navigate])

  const handleClear = useCallback(() => {
    speechRef.current?.stop()
    setTranscript('')
    transcriptRef.current = ''
    setMicState('idle')
    setError('')
  }, [])

  // ── Mic button appearance ───────────────────────────────────────────────────
  const micBg =
    micState === 'recording'    ? colors.tealAccent
    : micState === 'transcribing' ? colors.warningOrange
    : micState === 'done'         ? colors.successGreen
    :                               colors.primaryPurple

  const micLabel =
    micState === 'idle'         ? 'Click to start speaking'
    : micState === 'recording'  ? 'Recording — click to stop'
    : micState === 'transcribing' ? 'Transcribing…'
    :                              'Done — click mic to record more'

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 24px 56px',
        // No top gap wasted on mic button
        maxWidth: 620,
        margin: '0 auto',
        fontFamily: 'var(--font-family)',
      }}
    >
      {/* Heading */}
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: colors.darkText,
          marginBottom: 8,
          textAlign: 'center',
        }}
      >
        Describe Your Workflow
      </h2>
      <p
        style={{
          color: '#777',
          fontSize: 14,
          marginBottom: 28,
          textAlign: 'center',
          lineHeight: 1.65,
          maxWidth: 460,
        }}
      >
        Describe your work process — the people involved, the steps taken, and
        any decisions made. FlowMind will generate a diagram.
      </p>

      {/* ── Mic button ── */}
      <button
        onClick={handleMicClick}
        disabled={micState === 'transcribing'}
        title={micLabel}
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: micState === 'transcribing' ? colors.borderGray : micBg,
          border: 'none',
          cursor: micState === 'transcribing' ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 10,
          boxShadow: micState === 'recording'
            ? `0 0 0 6px ${colors.tealAccent}33`
            : '0 2px 8px rgba(0,0,0,0.18)',
          transition: 'background 0.2s, box-shadow 0.2s',
          flexShrink: 0,
        }}
      >
        {micState === 'transcribing' ? (
          <Spinner color="rgba(255,255,255,0.8)" />
        ) : (
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="2" width="6" height="11" rx="3" fill="white" />
            <path
              d="M5 11a7 7 0 0 0 14 0"
              stroke="white" strokeWidth="2" strokeLinecap="round"
            />
            <line x1="12" y1="18" x2="12" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <line x1="8" y1="22" x2="16" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Mic state label */}
      <p style={{ fontSize: 12, color: '#999', marginBottom: 10, textAlign: 'center' }}>
        {micLabel}
      </p>

      {/* ── Audio level visualisation — bars animate live while recording ── */}
      <div
        ref={barsRef}
        style={{
          display:        'flex',
          gap:            4,
          alignItems:     'center',
          justifyContent: 'center',
          height:         40,
          marginBottom:   10,
          opacity:        micState === 'recording' ? 1 : 0,
          transition:     'opacity 0.25s',
          pointerEvents:  'none',
        }}
      >
        {BAR_MULTS.map((_, i) => (
          <div
            key={i}
            style={{
              width:        4,
              height:       3,
              background:   colors.tealAccent,
              borderRadius: 2,
              transition:   'height 0.06s ease',
            }}
          />
        ))}
      </div>

      {/* ── Whisper model download progress bar (first-run only, ~39 MB) ── */}
      {whisperProgress && (
        <div className="fade-in" style={{ width: '100%', marginBottom: 14 }}>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 5 }}>
            {whisperProgress.status === 'initiate'
              ? 'Preparing speech model…'
              : whisperProgress.status === 'loading'
              ? 'Loading speech model…'
              : `Downloading speech model — first use only (${
                  whisperProgress.total
                    ? `${((whisperProgress.loaded ?? 0) / 1_048_576).toFixed(1)} / ${(whisperProgress.total / 1_048_576).toFixed(1)} MB`
                    : `${(whisperProgress.progress ?? 0).toFixed(0)}%`
                })`}
          </p>
          <div
            style={{
              width:        '100%',
              height:       4,
              background:   colors.borderGray,
              borderRadius: 4,
              overflow:     'hidden',
            }}
          >
            <div
              style={{
                width:        `${Math.min(100, whisperProgress.progress ?? 0)}%`,
                height:       '100%',
                background:   colors.primaryPurple,
                borderRadius: 4,
                transition:   'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* ── Diagram type preview badge ── */}
      {wordCount > 0 && (
        <div
          className="badge badge-primary fade-in"
          style={{ marginBottom: 16, fontSize: 12, padding: '5px 14px', gap: 6 }}
        >
          Predicted type:&nbsp;
          <strong>
            {DIAGRAM_TYPE_ICONS[guessedType]} {DIAGRAM_TYPE_LABELS[guessedType]}
          </strong>
        </div>
      )}

      {/* ── Transcript — editable so users can type or correct mic output ── */}
      <textarea
        ref={transcriptBoxRef}
        autoFocus
        value={transcript}
        onChange={(e) => {
          setTranscript(e.target.value)
          transcriptRef.current = e.target.value
        }}
        placeholder={
          micState === 'recording'
            ? 'Listening — start speaking…'
            : 'Speak your workflow, or type it here…'
        }
        style={{
          width: '100%',
          minHeight: 140,
          maxHeight: 240,
          background: colors.white,
          border: `1.5px solid ${micState === 'recording' ? colors.tealAccent : colors.borderGray}`,
          borderRadius: 10,
          padding: '14px 16px',
          fontSize: 14,
          color: colors.darkText,
          lineHeight: 1.65,
          marginBottom: 8,
          overflowY: 'auto',
          transition: 'border-color 0.25s',
          resize: 'none',
          fontFamily: 'var(--font-family)',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      {/* ── Word count + node estimate ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          fontSize: 12,
          color: '#aaa',
          marginBottom: 20,
        }}
      >
        <span>
          {wordCount} word{wordCount !== 1 ? 's' : ''}
          {wordCount > 0 && wordCount < 10 && (
            <span style={{ color: colors.warningOrange, fontWeight: 600 }}>
              {' '}· {10 - wordCount} more to enable Generate
            </span>
          )}
          {wordCount >= 10 && (
            <span style={{ color: colors.successGreen, fontWeight: 600 }}>
              {' '}· Ready to generate ✓
            </span>
          )}
        </span>
        {estNodes > 0 && (
          <span>~{estNodes} nodes estimated</span>
        )}
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div
          className="alert alert-error fade-in"
          style={{ width: '100%', marginBottom: 16 }}
        >
          {error}
        </div>
      )}

      {/* ── Generate button ── */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        style={{
          width: '100%',
          background: canGenerate ? colors.primaryPurple : colors.borderGray,
          color: colors.white,
          border: 'none',
          borderRadius: 10,
          padding: '14px',
          fontSize: 15,
          fontWeight: 600,
          cursor: canGenerate ? 'pointer' : 'not-allowed',
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          transition: 'background 0.2s',
          fontFamily: 'var(--font-family)',
        }}
      >
        {generating ? (
          <>
            <Spinner />
            Generating diagram…
          </>
        ) : (
          'Generate Flow →'
        )}
      </button>

      {/* ── Clear link — only shown when there's something to clear ── */}
      {(transcript.length > 0 || error) && (
        <button
          onClick={handleClear}
          style={{
            background: 'none',
            border: 'none',
            color: '#bbb',
            fontSize: 13,
            cursor: 'pointer',
            textDecoration: 'underline',
            fontFamily: 'var(--font-family)',
          }}
        >
          Clear &amp; Start Over
        </button>
      )}
    </div>
  )
}

// ── Inline spinner for generate button and transcribing state ─────────────────
function Spinner({ color = '#fff', size = 16 }: { color?: string; size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `2px solid ${color}55`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        flexShrink: 0,
      }}
    />
  )
}
