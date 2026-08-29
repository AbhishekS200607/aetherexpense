/**
 * AetherExpense — Spacing & Layout Tokens
 * 4px base unit grid system.
 */

/** 4px grid spacing tokens */
export const Spacing = {
  0:    0,
  0.5:  2,
  1:    4,
  1.5:  6,
  2:    8,
  2.5:  10,
  3:    12,
  3.5:  14,
  4:    16,
  5:    20,
  6:    24,
  7:    28,
  8:    32,
  9:    36,
  10:   40,
  12:   48,
  14:   56,
  16:   64,
  20:   80,
  24:   96,
} as const;

/** Border radii */
export const Radius = {
  none:  0,
  sm:    6,
  base:  10,
  md:    14,
  lg:    18,
  xl:    24,
  '2xl': 32,
  full:  9999,
} as const;

/** Elevation/Shadow levels */
export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  base: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 16,
  },
} as const;

/** Z-index stack */
export const ZIndex = {
  base:    0,
  raised:  10,
  dropdown: 100,
  overlay: 200,
  modal:   300,
  toast:   400,
} as const;

/** Common layout dimensions */
export const Layout = {
  tabBarHeight:        64,
  headerHeight:        56,
  bottomSheetHandle:   28,
  transactionItemHeight: 72,
  cardMinHeight:       120,
  quickActionSize:     56,
} as const;
