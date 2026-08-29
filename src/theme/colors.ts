/**
 * AetherExpense — Color Palette
 * Dark-first design with light mode support.
 * All colors are HSL-tuned for financial UI legibility.
 */

export const Palette = {
  // Brand
  indigo: {
    50:  '#EEF2FF',
    100: '#E0E7FF',
    200: '#C7D2FE',
    300: '#A5B4FC',
    400: '#818CF8',
    500: '#6366F1', // primary
    600: '#4F46E5',
    700: '#4338CA',
    800: '#3730A3',
    900: '#312E81',
  },

  // Income / positive
  emerald: {
    50:  '#ECFDF5',
    100: '#D1FAE5',
    400: '#34D399',
    500: '#10B981',
    600: '#059669',
    700: '#047857',
  },

  // Expense / negative
  rose: {
    50:  '#FFF1F2',
    100: '#FFE4E6',
    400: '#FB7185',
    500: '#F43F5E',
    600: '#E11D48',
    700: '#BE123C',
  },

  // Warning
  amber: {
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
  },

  // Neutral
  slate: {
    50:  '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    850: '#172033',
    900: '#0F172A',
    950: '#080D18',
  },
} as const;

export interface AppColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceBorder: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryFaint: string;
  income: string;
  incomeLight: string;
  incomeFaint: string;
  expense: string;
  expenseLight: string;
  expenseFaint: string;
  warning: string;
  warningFaint: string;
  success: string;
  error: string;
  info: string;
  tabBar: string;
  tabBarBorder: string;
  tabActive: string;
  tabInactive: string;
  inputBackground: string;
  inputBorder: string;
  inputFocusBorder: string;
  cardGradientStart: string;
  cardGradientEnd: string;
  overlay: string;
  chart: readonly string[];
}

export const DarkColors: AppColors = {
  // Background layers
  background:     Palette.slate[950],
  surface:        Palette.slate[900],
  surfaceElevated: Palette.slate[800],
  surfaceBorder:  Palette.slate[700],

  // Text
  textPrimary:    '#F1F5F9',
  textSecondary:  Palette.slate[400],
  textTertiary:   Palette.slate[500],
  textInverse:    Palette.slate[900],

  // Brand
  primary:        Palette.indigo[500],
  primaryLight:   Palette.indigo[400],
  primaryDark:    Palette.indigo[700],
  primaryFaint:   'rgba(99, 102, 241, 0.12)',

  // Semantic
  income:         Palette.emerald[500],
  incomeLight:    Palette.emerald[400],
  incomeFaint:    'rgba(16, 185, 129, 0.12)',

  expense:        Palette.rose[500],
  expenseLight:   Palette.rose[400],
  expenseFaint:   'rgba(244, 63, 94, 0.12)',

  warning:        Palette.amber[500],
  warningFaint:   'rgba(245, 158, 11, 0.12)',

  // Status
  success:        Palette.emerald[500],
  error:          Palette.rose[500],
  info:           Palette.indigo[400],

  // UI
  tabBar:         Palette.slate[900],
  tabBarBorder:   Palette.slate[800],
  tabActive:      Palette.indigo[400],
  tabInactive:    Palette.slate[500],

  inputBackground: Palette.slate[800],
  inputBorder:    Palette.slate[700],
  inputFocusBorder: Palette.indigo[500],

  cardGradientStart: 'rgba(99, 102, 241, 0.15)',
  cardGradientEnd:   'rgba(15, 23, 42, 0)',

  // Overlay
  overlay:        'rgba(8, 13, 24, 0.85)',

  // Charts
  chart: [
    '#6366F1', // indigo
    '#10B981', // emerald
    '#F59E0B', // amber
    '#F43F5E', // rose
    '#3B82F6', // blue
    '#8B5CF6', // violet
    '#06B6D4', // cyan
    '#EC4899', // pink
  ],
};

export const LightColors: AppColors = {
  background:     Palette.slate[50],
  surface:        '#FFFFFF',
  surfaceElevated: Palette.slate[100],
  surfaceBorder:  Palette.slate[200],

  textPrimary:    Palette.slate[900],
  textSecondary:  Palette.slate[600],
  textTertiary:   Palette.slate[400],
  textInverse:    '#FFFFFF',

  primary:        Palette.indigo[600],
  primaryLight:   Palette.indigo[500],
  primaryDark:    Palette.indigo[800],
  primaryFaint:   'rgba(79, 70, 229, 0.08)',

  income:         Palette.emerald[600],
  incomeLight:    Palette.emerald[500],
  incomeFaint:    'rgba(5, 150, 105, 0.08)',

  expense:        Palette.rose[600],
  expenseLight:   Palette.rose[500],
  expenseFaint:   'rgba(225, 29, 72, 0.08)',

  warning:        Palette.amber[600],
  warningFaint:   'rgba(217, 119, 6, 0.08)',

  success:        Palette.emerald[600],
  error:          Palette.rose[600],
  info:           Palette.indigo[600],

  tabBar:         '#FFFFFF',
  tabBarBorder:   Palette.slate[200],
  tabActive:      Palette.indigo[600],
  tabInactive:    Palette.slate[400],

  inputBackground: '#FFFFFF',
  inputBorder:    Palette.slate[300],
  inputFocusBorder: Palette.indigo[500],

  cardGradientStart: 'rgba(79, 70, 229, 0.06)',
  cardGradientEnd:   'rgba(241, 245, 249, 0)',

  overlay:        'rgba(15, 23, 42, 0.6)',

  chart: [
    '#4F46E5',
    '#059669',
    '#D97706',
    '#E11D48',
    '#2563EB',
    '#7C3AED',
    '#0891B2',
    '#DB2777',
  ],
};


