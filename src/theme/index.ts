/**
 * AetherExpense — Theme Index
 * Exports the full theme object and a useTheme() hook.
 */

import { useColorScheme } from 'react-native';
import { DarkColors, LightColors, type AppColors } from './colors';
import { FontSize, FontWeight, LineHeight, LetterSpacing, TextPresets } from './typography';
import { Spacing, Radius, Shadow, ZIndex, Layout } from './spacing';

export const theme = {
  colors: {
    dark:  DarkColors,
    light: LightColors,
  },
  fontSize:      FontSize,
  fontWeight:    FontWeight,
  lineHeight:    LineHeight,
  letterSpacing: LetterSpacing,
  textPresets:   TextPresets,
  spacing:       Spacing,
  radius:        Radius,
  shadow:        Shadow,
  zIndex:        ZIndex,
  layout:        Layout,
} as const;

export type Theme = typeof theme & { colors: AppColors };

/**
 * Returns the active color set (dark or light) plus all other tokens.
 * Use this instead of reading colors directly to support theming.
 */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? DarkColors : LightColors;
  return { ...theme, colors } as Theme;
}

// Named re-exports for convenience
export { DarkColors, LightColors } from './colors';
export type { AppColors } from './colors';
export { FontSize, FontWeight, TextPresets } from './typography';
export { Spacing, Radius, Shadow, ZIndex, Layout } from './spacing';
