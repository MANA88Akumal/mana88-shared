// Brand palette — reads CSS custom properties with hardcoded fallbacks
function cssVar(name, fallback) {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

export const palette = {
  gold: '#ce9e62',
  red: '#c1432e',
  silver: '#4b6777',
  black: '#2c2c2c',
  cream: '#faf8f5',
  border: '#e8e0d6',
  white: '#ffffff',
}

/** Read runtime palette (tenant overrides via CSS vars) */
export function getRuntimePalette() {
  return {
    gold: cssVar('--mana-gold', palette.gold),
    red: cssVar('--mana-red', palette.red),
    silver: cssVar('--mana-silver', palette.silver),
    black: cssVar('--mana-black', palette.black),
    cream: cssVar('--mana-cream', palette.cream),
    border: cssVar('--mana-border', palette.border),
    white: palette.white,
  }
}

export const LOGO_URL = 'https://login.terraia.io/logo-dark.png'
export const LOGO_LIGHT_URL = 'https://login.terraia.io/logo-light.png'

/**
 * Theme-aware color map using CSS custom properties.
 * Drop-in replacement for hardcoded `const C = {...}` in product apps.
 * Values are CSS strings that work in inline styles:
 *   style={{ background: C.bg, color: C.t1 }}
 */
export const themeColors = {
  // Brand / accent
  gold: 'rgb(var(--accent-primary))',
  red: 'rgb(var(--error))',
  silver: 'rgb(var(--info))',
  black: 'rgb(var(--text-primary))',
  warn: 'rgb(var(--warning))',

  // Text hierarchy
  t1: 'rgb(var(--text-primary))',
  t2: 'rgb(var(--text-secondary))',
  t3: 'rgb(var(--text-tertiary))',
  tInvert: 'rgb(var(--text-invert))',

  // Surfaces
  bg: 'rgb(var(--surface-0))',
  s: 'rgb(var(--surface-1))',
  s2: 'rgb(var(--surface-2))',
  s3: 'rgb(var(--surface-3))',

  // Borders
  border: 'rgb(var(--border-default))',
  borderStrong: 'rgb(var(--border-strong))',

  // Status
  success: 'rgb(var(--success))',
  successSubtle: 'rgb(var(--success-subtle))',
  error: 'rgb(var(--error))',
  errorSubtle: 'rgb(var(--error-subtle))',
  warning: 'rgb(var(--warning))',
  warningSubtle: 'rgb(var(--warning-subtle))',
  info: 'rgb(var(--info))',
  infoSubtle: 'rgb(var(--info-subtle))',

  // Brand
  accent: 'rgb(var(--accent-primary))',
  accentHover: 'rgb(var(--accent-hover))',
  accentSubtle: 'rgb(var(--accent-subtle))',
  brand: 'rgb(var(--brand-primary))',
  brandSubtle: 'rgb(var(--brand-subtle))',

  // Legacy compat (Planning.jsx etc.)
  cream: 'rgb(var(--surface-2))',
  cardBg: 'rgb(var(--surface-1))',
  rowHover: 'rgb(var(--accent-primary) / 0.04)',
  hoverBg: 'rgb(var(--surface-3))',
  white: 'rgb(var(--surface-1))',

  // Sidebar (always dark)
  sidebarBg: 'rgb(var(--sidebar-bg))',
  sidebarText: 'rgb(var(--sidebar-text))',
  sidebarActive: 'rgb(var(--sidebar-active))',
}

/** Get current theme name */
export function getTheme() {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.getAttribute('data-theme') || 'light'
}

/** Set theme and persist to localStorage */
export function setTheme(theme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('terraia-theme', theme)
}

/** Toggle between light and dark */
export function toggleTheme() {
  setTheme(getTheme() === 'light' ? 'dark' : 'light')
}
