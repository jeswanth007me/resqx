/**
 * ResQX Design Tokens
 * Source: Stitch Project "ResQX Emergency Operations Center" (ID: 6434206381845141979)
 *
 * These tokens are the single source of truth for all design values used in
 * the ResQX application. They mirror the Stitch EOCC design system exactly.
 *
 * DO NOT hard-code colors or spacing values in components. Import from here.
 */

// ─── Surface Hierarchy ───────────────────────────────────────────────
export const colors = {
  background: '#0B1326',
  surface: '#0B1326',
  surfaceDim: '#0B1326',
  surfaceBright: '#31394D',
  surfaceContainerLowest: '#060E20',
  surfaceContainerLow: '#131B2E',
  surfaceContainer: '#171F33',
  surfaceContainerHigh: '#222A3D',
  surfaceContainerHighest: '#2D3449',
  surfaceVariant: '#2D3449',

  // Semantic: Primary (Emergency Red family)
  primary: '#FFB3AD',
  primaryContainer: '#FF5451',
  onPrimary: '#68000A',
  onPrimaryContainer: '#5C0008',
  inversePrimary: '#B91A24',

  // Semantic: Secondary (Success Green family)
  secondary: '#4EDEA3',
  secondaryContainer: '#00A572',
  onSecondary: '#003824',
  onSecondaryContainer: '#00311F',

  // Semantic: Tertiary (Warning Amber family)
  tertiary: '#FFB95F',
  tertiaryContainer: '#CA8100',
  onTertiary: '#472A00',
  onTertiaryContainer: '#3E2400',

  // Error
  error: '#FFB4AB',
  errorContainer: '#93000A',
  onError: '#690005',
  onErrorContainer: '#FFDAD6',

  // Text
  onSurface: '#DAE2FD',
  onSurfaceVariant: '#E4BEBA',
  onBackground: '#DAE2FD',

  // Borders
  outline: '#AB8986',
  outlineVariant: '#5B403E',

  // Inverse
  inverseSurface: '#DAE2FD',
  inverseOnSurface: '#283044',

  // Surface tint
  surfaceTint: '#FFB3AD',
} as const;

// ─── Override Colors (from Stitch designTheme) ───────────────────────
// These are the base hues used to generate the full palette
export const overrideColors = {
  primary: '#EF4444',
  secondary: '#10B981',
  tertiary: '#F59E0B',
  neutral: '#0F172A',
} as const;

// ─── Legacy Reference Colors ─────────────────────────────────────────
// Referenced in Stitch design documentation
export const referenceColors = {
  primaryText: '#F8FAFC',
  secondaryText: '#94A3B8',
  panelBorder: '#334155',
} as const;

// ─── Status Colors ───────────────────────────────────────────────────
export const statusColors = {
  critical: colors.error,
  criticalBg: colors.errorContainer,
  active: colors.secondary,
  activeBg: colors.secondaryContainer,
  preparing: colors.tertiary,
  preparingBg: colors.tertiaryContainer,
  normal: colors.onSurfaceVariant,
  override: colors.error,
} as const;

// ─── Typography ──────────────────────────────────────────────────────
export const fontFamily = {
  headline: "'Inter', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
  data: "'JetBrains Mono', ui-monospace, monospace",
} as const;

export const typeScale = {
  headlineXl: { fontSize: '32px', fontWeight: '700', lineHeight: '40px', letterSpacing: '-0.02em' },
  headlineLg: { fontSize: '24px', fontWeight: '600', lineHeight: '32px' },
  headlineMd: { fontSize: '20px', fontWeight: '600', lineHeight: '28px' },
  bodyLg: { fontSize: '16px', fontWeight: '400', lineHeight: '24px' },
  bodySm: { fontSize: '14px', fontWeight: '400', lineHeight: '20px' },
  dataDisplay: { fontSize: '18px', fontWeight: '500', lineHeight: '24px', letterSpacing: '-0.01em' },
  dataLabel: { fontSize: '12px', fontWeight: '600', lineHeight: '16px' },
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────
export const spacing = {
  unit: '4px',
  gutter: '16px',
  margin: '24px',
  panelPadding: '20px',
} as const;

// ─── Border Radius ───────────────────────────────────────────────────
export const borderRadius = {
  sm: '0.125rem',   // 2px
  DEFAULT: '0.25rem', // 4px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  full: '9999px',
} as const;

// ─── Elevation / Panel Levels ────────────────────────────────────────
export const elevation = {
  base: {
    background: colors.background,
  },
  panel: {
    background: colors.surfaceContainerLow,
    border: '1px solid #334155',
  },
  overlay: {
    background: colors.surfaceContainer,
    backdropFilter: 'blur(12px)',
    opacity: 0.6,
  },
} as const;

// ─── Glass Panel Styles ──────────────────────────────────────────────
export const glassPanel = {
  header: {
    background: 'rgba(23, 31, 51, 0.6)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(218, 226, 253, 0.1)',
  },
  controlBar: {
    background: 'rgba(19, 27, 46, 0.8)',
    backdropFilter: 'blur(16px)',
    borderTop: '1px solid rgba(218, 226, 253, 0.1)',
  },
} as const;

// ─── Navigation Tabs ─────────────────────────────────────────────────
export const navigationTabs = [
  { label: 'Simulation', path: 'simulation' },
  { label: 'Emergency Queue', path: 'emergency-queue' },
  { label: 'Signals', path: 'signals' },
  { label: 'Network Analytics', path: 'network-analytics' },
  { label: 'Settings', path: 'settings' },
] as const;
