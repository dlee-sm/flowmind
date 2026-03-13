import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useFlowStore } from './store/useFlowStore'
import Home from './components/Home'
import Record from './components/Record'
import Canvas from './components/Canvas'
import Settings from './components/Settings'
import { colors, radii, shadows } from './styles/theme'

// ── Route guard ──────────────────────────────────────────────────────────────

function Guard({ children }: { children: React.ReactNode }) {
  const hasApiKey = useFlowStore((s) => s.hasApiKey)
  if (!hasApiKey) return <Navigate to="/settings" state={{ fromGuard: true }} replace />
  return <>{children}</>
}

// ── App header ───────────────────────────────────────────────────────────────

const PAGE_TITLES: Record<string, string> = {
  '/record':   'New Flow',
  '/settings': 'Settings',
}

function AppHeader() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const [gearHov, setGearHov] = useState(false)

  const isHome     = location.pathname === '/'
  const isSettings = location.pathname === '/settings'
  const title      = PAGE_TITLES[location.pathname]

  return (
    <div
      style={{
        height: 52,
        background: colors.white,
        borderBottom: `1px solid ${colors.borderGray}`,
        boxShadow: shadows.sm,
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 12,
        flexShrink: 0,
        // Allow dragging the Electron window via the header bar
        WebkitAppRegion: 'drag',
        // On macOS (hiddenInset title bar) the traffic-light buttons occupy
        // ~72px from the left — push content past them.
        paddingLeft: 80,
      } as React.CSSProperties}
    >
      {/* Logo mark */}
      <div
        style={{
          width: 30,
          height: 30,
          background: `linear-gradient(135deg, ${colors.primaryPurple} 0%, ${colors.tealAccent} 100%)`,
          borderRadius: radii.md,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          flexShrink: 0,
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        ⬡
      </div>

      {/* Wordmark */}
      <span
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: colors.darkText,
          letterSpacing: '-0.3px',
          flexShrink: 0,
        }}
      >
        Flow<span style={{ color: colors.primaryPurple }}>Mind</span>
      </span>

      {/* Breadcrumb — shown when not on home */}
      {!isHome && (
        <>
          <div style={{ width: 1, height: 16, background: colors.borderGray }} />

          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none',
              border: 'none',
              color: colors.primaryPurple,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 0',
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties}
          >
            ←
          </button>

          {title && (
            <span style={{ fontSize: 13, color: '#888', fontWeight: 500 }}>{title}</span>
          )}
        </>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Gear icon — hidden on /settings */}
      {!isSettings && (
        <button
          onClick={() => navigate('/settings')}
          onMouseEnter={() => setGearHov(true)}
          onMouseLeave={() => setGearHov(false)}
          title="Settings"
          style={{
            width: 34,
            height: 34,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: gearHov ? colors.lightPurple : 'none',
            border: `1.5px solid ${gearHov ? colors.primaryPurple : colors.borderGray}`,
            borderRadius: radii.md,
            fontSize: 16,
            cursor: 'pointer',
            transition: 'border-color 0.15s, background 0.15s',
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}
        >
          ⚙
        </button>
      )}
    </div>
  )
}

// ── App shell: persistent header + scrollable page content ───────────────────

function AppShell() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppHeader />
      <div style={{ flex: 1, overflowY: 'auto', background: colors.background }}>
        <Outlet />
      </div>
    </div>
  )
}

// ── Splash screen shown while checking saved API key ─────────────────────────

function Splash() {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.background,
        gap: 20,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          background: `linear-gradient(135deg, ${colors.primaryPurple} 0%, ${colors.tealAccent} 100%)`,
          borderRadius: radii.lg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          boxShadow: shadows.card,
        }}
      >
        ⬡
      </div>
      <span className="spinner" style={{ width: 24, height: 24 }} />
    </div>
  )
}

// ── Route tree ───────────────────────────────────────────────────────────────

function AppRoutes() {
  const { setHasApiKey } = useFlowStore()
  const [checking, setChecking] = useState(true)

  // Resolve stored key before rendering any routes to prevent the race
  // condition where hasApiKey=false causes a premature redirect to /settings.
  useEffect(() => {
    window.electronAPI.getApiKey().then((key) => {
      setHasApiKey(!!key)
      setChecking(false)
    })
  }, [setHasApiKey])

  if (checking) return <Splash />

  return (
    <Routes>
      {/* Pages that share the persistent header */}
      <Route element={<AppShell />}>
        <Route path="/"         element={<Guard><Home /></Guard>} />
        <Route path="/record"   element={<Guard><Record /></Guard>} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* Canvas is full-screen — no header */}
      <Route path="/canvas/:id" element={<Guard><Canvas /></Guard>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
