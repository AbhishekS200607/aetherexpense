/**
 * AetherExpense — Settings Store (Zustand)
 *
 * Persists lightweight UI preferences using AsyncStorage.
 * Database settings (currency etc.) are the source of truth in SQLite;
 * this store caches them for synchronous UI access.
 */

import { create } from 'zustand';
import { DEFAULT_SETTINGS, type AppSettings } from '../types/settings';

interface SettingsState extends AppSettings {
  _hydrated: boolean;
  setHydrated: (v: boolean) => void;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetToDefaults: () => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  ...DEFAULT_SETTINGS,
  _hydrated: false,

  setHydrated: (v) => set({ _hydrated: v }),

  updateSetting: (key, value) =>
    set((state) => ({ ...state, [key]: value })),

  updateSettings: (partial) =>
    set((state) => ({ ...state, ...partial })),

  resetToDefaults: () =>
    set({ ...DEFAULT_SETTINGS, _hydrated: true }),
}));
