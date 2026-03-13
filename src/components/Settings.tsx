import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useFlowStore } from '../store/useFlowStore'
import { testConnection } from '../services/claude'
import type { TestResult } from '../types'
import { colors, radii, shadows } from '../styles/theme'

export default function Settings() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { setHasApiKey, hasApiKey, snapToGrid, setSnapToGrid, showGridlines, setShowGridlines } = useFlowStore()
  const fromGuard = (location.state as { fromGuard?: boolean } | null)?.fromGuard ?? false

  const [apiKey, setApiKey]       = useState('')
  const [showKey, setShowKey]     = useState(false)
  const [testing, setTesting]     = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  // Pre-fill with any previously stored key
  useEffect(() => {
    window.electronAPI.getApiKey().then((k) => { if (k) setApiKey(k) })
  }, [])

  // ── Test connection ────────────────────────────────────────────────────────
  const handleTest = async () => {
    const key = apiKey.trim()
    if (!key || testing) return
    setTesting(true)
    setTestResult(null)
    const result = await testConnection(key)
    setTestResult(result)
    setTesting(false)
  }

  // ── Save key + redirect ────────────────────────────────────────────────────
  const handleSave = async () => {
    const key = apiKey.trim()
    if (!key || saving || saved) return
    setSaving(true)
    await window.electronAPI.saveApiKey(key)
    setHasApiKey(true)
    setSaved(true)
    setSaving(false)
    // Brief success flash, then go home
    setTimeout(() => navigate('/'), 900)
  }

  const trimmedKey = apiKey.trim()
  const canSave    = !!trimmedKey && !saving && !saved

  return (
    <div style={{ minHeight: '100vh', background: colors.background, fontFamily: "'Inter', sans-serif" }}>

      {/* ── Page content ───────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 560, width: '100%', margin: '0 auto', padding: '36px 24px 64px' }}>

        {/* Friendly redirect banner */}
        {(fromGuard || !hasApiKey) && (
          <div className="alert alert-warning fade-in" style={{ marginBottom: 20 }}>
            🔑 To start using FlowMind, please add your Anthropic API key below.
          </div>
        )}

        {/* ── API Key card ───────────────────────────────────────────────── */}
        <div className="card fade-in" style={{ marginBottom: 20 }}>

          {/* Card header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
            <div
              style={{
                width: 38,
                height: 38,
                background: colors.lightPurple,
                borderRadius: radii.md,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              🔑
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.darkText }}>
                Anthropic API Key
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: '#999', marginTop: 2 }}>
                Required to generate diagrams with Claude
              </p>
            </div>
          </div>

          {/* Input + reveal toggle */}
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
            API Key
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input
              className="input"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setTestResult(null); setSaved(false) }}
              onKeyDown={(e) => e.key === 'Enter' && handleTest()}
              placeholder="sk-ant-api03-…"
              spellCheck={false}
              autoComplete="off"
              style={{ flex: 1, fontFamily: showKey ? 'monospace' : "'Inter', sans-serif", fontSize: 13 }}
            />
            <button
              onClick={() => setShowKey((v) => !v)}
              title={showKey ? 'Hide key' : 'Reveal key'}
              style={{
                border: `1.5px solid ${colors.borderGray}`,
                borderRadius: radii.md,
                padding: '0 14px',
                background: colors.background,
                color: colors.darkText,
                fontSize: 16,
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = colors.primaryPurple)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = colors.borderGray)}
            >
              {showKey ? '🙈' : '👁'}
            </button>
          </div>

          {/* Test Connection button */}
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleTest}
            disabled={!trimmedKey || testing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 12 }}
          >
            {testing && (
              <span
                className="spinner"
                style={{ width: 14, height: 14, borderWidth: '2px' }}
              />
            )}
            {testing ? 'Testing…' : 'Test Connection'}
          </button>

          {/* Test result */}
          {testResult && (
            <div
              className={`alert fade-in ${testResult.ok ? 'alert-success' : 'alert-error'}`}
              style={{ marginBottom: 14 }}
            >
              {testResult.ok ? '✓  ' : '✗  '}
              {testResult.message}
            </div>
          )}

          {/* Console link */}
          <a
            href="https://console.anthropic.com"
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 12, color: colors.tealAccent, display: 'inline-block', marginBottom: 22 }}
          >
            Get your API key at console.anthropic.com →
          </a>

          <div className="divider" style={{ margin: '0 0 20px' }} />

          {/* Save button */}
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!canSave}
            style={{
              width: '100%',
              fontSize: 15,
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: saved ? colors.successGreen : colors.primaryPurple,
              transition: 'background 0.3s',
            }}
          >
            {saving && (
              <span
                className="spinner"
                style={{
                  width: 16,
                  height: 16,
                  borderWidth: '2px',
                  borderColor: 'rgba(255,255,255,0.3)',
                  borderTopColor: 'rgba(255,255,255,0.9)',
                }}
              />
            )}
            {saved ? '✓  Saved — going home…' : saving ? 'Saving…' : 'Save API Key'}
          </button>
        </div>

        {/* ── Canvas Settings card ───────────────────────────────────────── */}
        <div className="card fade-in" style={{ marginBottom: 20 }}>

          {/* Card header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
            <div
              style={{
                width: 38,
                height: 38,
                background: colors.lightPurple,
                borderRadius: radii.md,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              ⚙️
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.darkText }}>
                Canvas Settings
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: '#999', marginTop: 2 }}>
                Customize how the canvas behaves
              </p>
            </div>
          </div>

          {/* Snap to Grid toggle */}
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, cursor: 'pointer' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.darkText, marginBottom: 2 }}>
                Snap to Grid
              </div>
              <div style={{ fontSize: 12, color: '#999' }}>
                Align nodes to a 20x20 pixel grid when dragging
              </div>
            </div>
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={(e) => setSnapToGrid(e.target.checked)}
              style={{ width: 20, height: 20, cursor: 'pointer' }}
            />
          </label>

          {/* Show Gridlines toggle */}
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.darkText, marginBottom: 2 }}>
                Show Gridlines
              </div>
              <div style={{ fontSize: 12, color: '#999' }}>
                Display dot grid pattern on canvas background
              </div>
            </div>
            <input
              type="checkbox"
              checked={showGridlines}
              onChange={(e) => setShowGridlines(e.target.checked)}
              style={{ width: 20, height: 20, cursor: 'pointer' }}
            />
          </label>

        </div>

        {/* ── About card ─────────────────────────────────────────────────── */}
        <div className="card fade-in">

          {/* FlowMind wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div
              style={{
                width: 46,
                height: 46,
                background: `linear-gradient(135deg, ${colors.primaryPurple} 0%, ${colors.tealAccent} 100%)`,
                borderRadius: radii.lg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                flexShrink: 0,
                boxShadow: shadows.card,
              }}
            >
              ⬡
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: colors.darkText, lineHeight: 1.1 }}>
                Flow<span style={{ color: colors.primaryPurple }}>Mind</span>
              </div>
              <div style={{ fontSize: 12, color: '#aaa', marginTop: 3 }}>Version 0.1.0</div>
            </div>
          </div>

          <div className="divider" />

          {/* SonderMind branding */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
            <div
              style={{
                width: 36,
                height: 36,
                background: colors.primaryPurple,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.white,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                flexShrink: 0,
              }}
            >
              S
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.darkText }}>
                SonderMind
              </div>
              <div style={{ fontSize: 12, color: '#999' }}>
                Built for SonderMind internal use only
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
