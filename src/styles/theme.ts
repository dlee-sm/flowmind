// ─── Color tokens ────────────────────────────────────────────────────────────
// Single source of truth. Components use CSS variables; this file declares both.
export const colors = {
  primaryPurple: '#5B2D8E',
  tealAccent:    '#00B5AD',
  background:    '#F9F7F4',
  darkText:      '#1A1A2E',
  lightPurple:   '#E8E4F0',
  white:         '#FFFFFF',
  successGreen:  '#27AE60',
  warningOrange: '#F39C12',
  errorRed:      '#E74C3C',
  borderGray:    '#D5D0E5',
} as const

// ─── CSS variable names ───────────────────────────────────────────────────────
// Use these when you need to reference a variable programmatically.
export const cssVars = {
  primary:     'var(--color-primary)',
  teal:        'var(--color-teal)',
  bg:          'var(--color-bg)',
  dark:        'var(--color-dark)',
  lightPurple: 'var(--color-light-purple)',
  white:       'var(--color-white)',
  success:     'var(--color-success)',
  warning:     'var(--color-warning)',
  error:       'var(--color-error)',
  border:      'var(--color-border)',
  font:        'var(--font-family)',
} as const

// ─── Typography ───────────────────────────────────────────────────────────────
export const typography = {
  fontFamily:    "'Inter', sans-serif",
  weightBody:    400,
  weightLabel:   600,
  weightHeading: 700,
  sizeXs:   '11px',
  sizeSm:   '13px',
  sizeBase: '14px',
  sizeMd:   '16px',
  sizeLg:   '20px',
  sizeXl:   '24px',
  size2xl:  '28px',
  lineHeight: 1.5,
} as const

// ─── Spacing ──────────────────────────────────────────────────────────────────
export const spacing = {
  xs:  '4px',
  sm:  '8px',
  md:  '12px',
  lg:  '16px',
  xl:  '24px',
  '2xl': '32px',
  '3xl': '48px',
} as const

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const shadows = {
  sm:    '0 1px 4px rgba(0,0,0,0.08)',
  md:    '0 2px 8px rgba(0,0,0,0.12)',
  lg:    '0 4px 16px rgba(0,0,0,0.14)',
  hover: '0 4px 12px rgba(91,45,142,0.18)',
  card:  '0 2px 8px rgba(91,45,142,0.10)',
  glass: '0 4px 24px rgba(0,0,0,0.10)',
} as const

// ─── Border radii ─────────────────────────────────────────────────────────────
export const radii = {
  sm:   '4px',
  md:   '8px',
  lg:   '12px',
  xl:   '16px',
  pill: '999px',
} as const

// ─── Node colors (diagram-specific) ──────────────────────────────────────────
export const nodeColors = {
  startEnd:  { bg: colors.tealAccent,    text: colors.white },
  process:   { bg: colors.primaryPurple, text: colors.white },
  decision:  { bg: colors.warningOrange, text: colors.white },
  swimlane:  { bg: colors.lightPurple,   text: colors.primaryPurple },
  mindmap:   { bg: colors.lightPurple,   text: colors.darkText },
  selection: colors.tealAccent,
  edge:      colors.darkText,
} as const
