/**
 * AetherExpense — Global Toast Notification Store
 *
 * Provides application-wide state management for animated toast notifications.
 */

import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastPayload {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastState {
  toast: (ToastPayload & { id: string }) | null;
  showToast: (payload: ToastPayload) => void;
  hideToast: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  showToast: (payload) =>
    set({
      toast: {
        ...payload,
        id: String(Date.now()),
      },
    }),
  hideToast: () => set({ toast: null }),
}));
