/**
 * AetherExpense — Typography Scale
 * Uses the system font stack on Android/iOS.
 * Scale follows a modular ratio (1.250 — Major Third).
 */

export const FontSize = {
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  '2xl': 28,
  '3xl': 34,
  '4xl': 40,
  '5xl': 48,
} as const;

export const FontWeight = {
  regular:   '400' as const,
  medium:    '500' as const,
  semibold:  '600' as const,
  bold:      '700' as const,
  extrabold: '800' as const,
} as const;

export const LineHeight = {
  tight:   1.2,
  normal:  1.5,
  relaxed: 1.75,
} as const;

export const LetterSpacing = {
  tight:  -0.5,
  normal:  0,
  wide:    0.5,
  wider:   1,
} as const;

/** Pre-composed text style presets */
export const TextPresets = {
  // Display
  displayLarge: {
    fontSize:   FontSize['4xl'],
    fontWeight: FontWeight.bold,
    letterSpacing: LetterSpacing.tight,
  },
  displayMedium: {
    fontSize:   FontSize['3xl'],
    fontWeight: FontWeight.bold,
    letterSpacing: LetterSpacing.tight,
  },
  displaySmall: {
    fontSize:   FontSize['2xl'],
    fontWeight: FontWeight.semibold,
    letterSpacing: LetterSpacing.tight,
  },

  // Headings
  h1: { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold },
  h2: { fontSize: FontSize.xl,    fontWeight: FontWeight.bold },
  h3: { fontSize: FontSize.lg,    fontWeight: FontWeight.semibold },
  h4: { fontSize: FontSize.md,    fontWeight: FontWeight.semibold },

  // Body
  bodyLarge:  { fontSize: FontSize.md,   fontWeight: FontWeight.regular },
  bodyMedium: { fontSize: FontSize.base, fontWeight: FontWeight.regular },
  bodySmall:  { fontSize: FontSize.sm,   fontWeight: FontWeight.regular },

  // Labels
  labelLarge:  { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  labelMedium: { fontSize: FontSize.sm,   fontWeight: FontWeight.medium },
  labelSmall:  { fontSize: FontSize.xs,   fontWeight: FontWeight.medium },

  // Captions
  caption: { fontSize: FontSize.xs, fontWeight: FontWeight.regular },

  // Amount (financial figures)
  amountLarge: {
    fontSize:   FontSize['3xl'],
    fontWeight: FontWeight.bold,
    letterSpacing: LetterSpacing.tight,
    fontVariant: ['tabular-nums'] as any,
  },
  amountMedium: {
    fontSize:   FontSize.xl,
    fontWeight: FontWeight.semibold,
    fontVariant: ['tabular-nums'] as any,
  },
  amountSmall: {
    fontSize:   FontSize.md,
    fontWeight: FontWeight.medium,
    fontVariant: ['tabular-nums'] as any,
  },
} as const;
