/**
 * AetherExpense — Ethos Finance Design System
 *
 * Sourced from the `stitch_ethos_finance / premium_editorial_finance` Stitch design.
 * Swiss-inspired minimalism: warm off-white background, near-black typography,
 * inter font family, 8px grid system.
 *
 * This module intentionally does NOT export dark-mode variants — the Stitch
 * design is a light-first system. Dark mode support can be layered on later.
 */

// ─── Color Tokens ─────────────────────────────────────────────────────────────

export const EthosColors = {
  // Backgrounds
  background:             '#fdf8f8',
  surface:                '#fdf8f8',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow:    '#f7f3f2',
  surfaceContainer:       '#f1edec',
  surfaceContainerHigh:   '#ebe7e6',
  surfaceContainerHighest:'#e5e2e1',
  surfaceDim:             '#ddd9d8',
  surfaceBright:          '#fdf8f8',
  surfaceVariant:         '#e5e2e1',

  // Text
  onSurface:         '#1c1b1b',   // primary text
  onSurfaceVariant:  '#444748',   // secondary text
  outline:           '#747878',   // muted text / labels
  outlineVariant:    '#c4c7c7',   // borders / dividers

  // Primary (near-black)
  primary:           '#000000',
  onPrimary:         '#ffffff',
  primaryContainer:  '#1c1b1b',
  onPrimaryContainer:'#858383',

  // Secondary (gray)
  secondary:            '#5e5e5e',
  onSecondary:          '#ffffff',
  secondaryContainer:   '#e3e2e2',
  onSecondaryContainer: '#646464',

  // Tertiary (accent — indigo for income indicators)
  tertiary:              '#000000',
  onTertiary:            '#ffffff',
  tertiaryContainer:     '#0f0069',
  onTertiaryContainer:   '#7671ff',  // indigo accent — positive amounts

  // Error
  error:            '#ba1a1a',
  onError:          '#ffffff',
  errorContainer:   '#ffdad6',
  onErrorContainer: '#93000a',

  // Inverse
  inverseSurface:   '#313030',
  inverseOnSurface: '#f4f0ef',
  inversePrimary:   '#c8c6c5',

  // Tints
  surfaceTint:  '#5f5e5e',

  // Fixed
  primaryFixed:            '#e5e2e1',
  primaryFixedDim:         '#c8c6c5',
  onPrimaryFixed:          '#1c1b1b',
  onPrimaryFixedVariant:   '#474746',
  secondaryFixed:          '#e3e2e2',
  secondaryFixedDim:       '#c7c6c6',
  onSecondaryFixed:        '#1b1c1c',
  onSecondaryFixedVariant: '#464747',
  tertiaryFixed:           '#e2dfff',
  tertiaryFixedDim:        '#c3c0ff',
  onTertiaryFixed:         '#0f0069',
  onTertiaryFixedVariant:  '#3323cc',

  // Semantic financial
  income:         '#059669',    // muted emerald
  incomeLight:    '#34d399',
  incomeFaint:    'rgba(5, 150, 105, 0.08)',
  expense:        '#dc2626',    // muted red — but amounts shown near-black per Stitch
  expenseFaint:   'rgba(220, 38, 38, 0.06)',

  // UI chrome
  tabBar:         '#ffffff',
  tabBarBorder:   '#c4c7c7',
  tabActive:      '#000000',
  tabInactive:    '#747878',

  // FAB
  fabBackground:  '#000000',
  fabForeground:  '#ffffff',
} as const;

export type EthosColorToken = keyof typeof EthosColors;

// ─── Typography Tokens ────────────────────────────────────────────────────────

/**
 * Font families.
 * These map to the font names registered via @expo-google-fonts/inter.
 */
export const EthosFonts = {
  /** Light weight — used for hero balance display */
  thin:       'Inter_200ExtraLight',
  light:      'Inter_300Light',
  regular:    'Inter_400Regular',
  medium:     'Inter_500Medium',
  semibold:   'Inter_600SemiBold',
  bold:       'Inter_700Bold',
  /** Fallback to system font if Inter is not yet loaded */
  system:     undefined as string | undefined,
} as const;

/**
 * Type scale matching the Stitch DESIGN.md exactly.
 * All sizes in px → dp.
 */
export const EthosTypography = {
  displayLg: {
    fontSize:      56,     // ≈72px scaled for mobile
    fontWeight:    '200' as const,
    lineHeight:    64,
    letterSpacing: -2.24, // -0.04em × 56
  },
  displayMd: {
    fontSize:      40,     // ≈48px scaled for mobile
    fontWeight:    '300' as const,
    lineHeight:    48,
    letterSpacing: -0.8,  // -0.02em × 40
  },
  headlineLg: {
    fontSize:      28,
    fontWeight:    '500' as const,
    lineHeight:    34,
    letterSpacing: 0,
  },
  bodyLg: {
    fontSize:      18,
    fontWeight:    '400' as const,
    lineHeight:    28,
    letterSpacing: 0,
  },
  bodyMd: {
    fontSize:      16,
    fontWeight:    '400' as const,
    lineHeight:    24,
    letterSpacing: 0,
  },
  labelMd: {
    fontSize:      14,
    fontWeight:    '500' as const,
    lineHeight:    20,
    letterSpacing: 0.14,  // 0.01em × 14
  },
  labelSm: {
    fontSize:      12,
    fontWeight:    '600' as const,
    lineHeight:    16,
    letterSpacing: 0.48,  // wider tracking for uppercase labels
  },
} as const;

// ─── Spacing Tokens ───────────────────────────────────────────────────────────

/**
 * 8px-unit grid system from the Stitch design spec.
 */
export const EthosSpacing = {
  unit:              8,
  containerPadding:  24,
  stackSm:           8,
  stackMd:           16,
  stackLg:           32,
  gutter:            16,
} as const;

// ─── Shape / Radius Tokens ─────────────────────────────────────────────────────

export const EthosRadius = {
  sm:   4,    // 0.25rem
  base: 8,    // 0.5rem
  md:   12,   // 0.75rem
  lg:   16,   // 1rem
  xl:   24,   // 1.5rem
  full: 9999,
} as const;

// ─── Shadow ───────────────────────────────────────────────────────────────────

/**
 * Per the Stitch design, shadows are minimal and used only for floating elements.
 */
export const EthosShadow = {
  none: {},
  card: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius:  20,
    elevation:     1,
  },
  fab: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius:  12,
    elevation:     8,
  },
} as const;

// ─── Border ───────────────────────────────────────────────────────────────────

export const EthosBorder = {
  color:  '#E5E5E5',   // 1px hairline cards
  width:  1,
} as const;
