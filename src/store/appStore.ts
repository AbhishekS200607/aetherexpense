/**
 * AetherExpense — App State Store (Zustand)
 *
 * Tracks global transient state: loading indicators, error messages,
 * DB readiness, and refresh triggers for hooks.
 */

import { create } from 'zustand';

interface AppState {
  /** True once the SQLite database is initialized and seeded */
  dbReady:           boolean;
  /** Global loading (e.g. import/export in progress) */
  isLoading:         boolean;
  /** Global error message (displayed in a toast/banner) */
  globalError:       string | null;
  /** Increment to trigger re-fetches in hooks (poor-man's invalidation) */
  dataVersion:       number;
  /** True when App Lock screen overlay is active */
  isLocked:          boolean;

  setDbReady:        (ready: boolean) => void;
  setLoading:        (loading: boolean) => void;
  setError:          (msg: string | null) => void;
  clearError:        () => void;
  /** Invalidate all data hooks to refetch from SQLite */
  invalidateData:    () => void;
  /** Lock or unlock the app UI overlay */
  setIsLocked:       (locked: boolean) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  dbReady:        false,
  isLoading:      false,
  globalError:    null,
  dataVersion:    0,
  isLocked:       false,

  setDbReady:     (ready) => set({ dbReady: ready }),
  setLoading:     (loading) => set({ isLoading: loading }),
  setError:       (msg) => set({ globalError: msg }),
  clearError:     () => set({ globalError: null }),
  invalidateData: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
  setIsLocked:    (locked) => set({ isLocked: locked }),
}));
