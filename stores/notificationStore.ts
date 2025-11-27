/**
 * Notification Store (Zustand)
 * Manages toast and snackbar notifications
 *
 * MIGRATION: Replaces NotificationContext
 * Benefits: No provider needed, simpler timeout management, selective re-renders
 */

import { create } from 'zustand';
import { logger } from '../utils/logger';
import { turboGlobal } from '../services/turbo/turboTokenStorage';
import type { ToastType, Toast, SnackbarParams } from '../types/notification';

// Re-export types
export type { ToastType, Toast, SnackbarType, SnackbarParams } from '../types/notification';

interface NotificationState {
  toasts: Toast[];
  snackbar: SnackbarParams | null;
}

interface NotificationActions {
  showToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: number) => void;
  showSnackbar: (params: SnackbarParams) => void;
  dismissSnackbar: () => void;
}

// Computed getters
interface NotificationComputed {
  toastMessage: string;
  toastVisible: boolean;
  toastType: ToastType;
}

type NotificationStore = NotificationState & NotificationActions;

// External refs for timeout management (not part of store state)
let nextToastId = 0;
const toastTimeouts: Record<number, NodeJS.Timeout> = {};
let snackbarTimeout: NodeJS.Timeout | null = null;
let lastSnackbar: SnackbarParams | null = null;
let dismissCooldown = false;
let snackbarKey = 0;

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  // State
  toasts: [],
  snackbar: null,

  // Toast Actions
  showToast: (message: string, type: ToastType = 'success') => {
    // Clear all existing timeouts
    Object.keys(toastTimeouts).forEach((key) => {
      clearTimeout(toastTimeouts[Number(key)]);
      delete toastTimeouts[Number(key)];
    });

    const id = nextToastId++;
    const duration = type === 'error' ? 3500 : 2000;

    // Replace all toasts with just this new one
    const newToast: Toast = { id, message, type };
    set({ toasts: [newToast] });

    // Auto-hide after duration
    toastTimeouts[id] = setTimeout(() => {
      set({ toasts: [] });
      delete toastTimeouts[id];
    }, duration);
  },

  dismissToast: (id: number) => {
    // Clear timeout
    if (toastTimeouts[id]) {
      clearTimeout(toastTimeouts[id]);
      delete toastTimeouts[id];
    }

    // Remove toast
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },

  // Snackbar Actions
  showSnackbar: (snackbarParams: SnackbarParams) => {
    logger.debug('🎯 NotificationStore showSnackbar called with:', snackbarParams);

    // If we just dismissed a snackbar, ignore new ones briefly
    if (dismissCooldown) {
      logger.debug('🎯 Ignoring snackbar during cooldown period');
      return;
    }

    // Define state hierarchy: pending < submitted < success
    const stateRank: Record<string, number> = {
      pending: 1,
      submitted: 2,
      success: 3,
      error: 99, // errors always show
    };

    // If we have a previous snackbar, check if this is the same transaction
    if (lastSnackbar && snackbarParams.action === lastSnackbar.action) {
      // Same action type - check if it's the same transaction
      const sameTx =
        (snackbarParams.txid && lastSnackbar.txid && snackbarParams.txid === lastSnackbar.txid) ||
        (!snackbarParams.txid && !lastSnackbar.txid);

      if (sameTx || !snackbarParams.txid || !lastSnackbar.txid) {
        const currentRank = stateRank[snackbarParams.type] || 0;
        const lastRank = stateRank[lastSnackbar.type] || 0;

        // Don't allow going backwards in state (e.g., submitted -> pending)
        if (currentRank < lastRank && snackbarParams.type !== 'error') {
          logger.debug('🎯 Ignoring backward state transition:', lastSnackbar.type, '->', snackbarParams.type);
          return;
        }
      }
    }

    lastSnackbar = snackbarParams;

    // Increment key to force new component instance
    snackbarKey += 1;

    set({ snackbar: { ...snackbarParams, key: snackbarKey } });

    // Clear any existing timeout first
    if (snackbarTimeout) {
      clearTimeout(snackbarTimeout);
      snackbarTimeout = null;
    }

    // Only auto-dismiss if not persistent
    if (!snackbarParams.persistent) {
      snackbarTimeout = setTimeout(() => {
        set({ snackbar: null });
        snackbarTimeout = null;
      }, 7000); // 7 seconds
    }
  },

  dismissSnackbar: () => {
    // Clear auto-dismiss timeout if exists
    if (snackbarTimeout) {
      clearTimeout(snackbarTimeout);
      snackbarTimeout = null;
    }

    set({ snackbar: null });
    lastSnackbar = null;

    // Clear any queued turbo snackbars
    if (typeof global !== 'undefined' && turboGlobal.pendingTurboSnackbars) {
      turboGlobal.pendingTurboSnackbars = [];
    }

    // Clear any pending token so it doesn't retry when coming back to app
    if (typeof global !== 'undefined' && turboGlobal.pendingCashuToken) {
      logger.debug('Clearing pending token on snackbar dismiss');
      turboGlobal.pendingCashuToken = undefined;
    }

    // Add cooldown period - block new snackbars for 500ms
    dismissCooldown = true;
    setTimeout(() => {
      dismissCooldown = false;
    }, 500);
  },
}));

/**
 * Selector hooks for granular subscriptions
 */
export const useToasts = () => useNotificationStore((state) => state.toasts);
export const useSnackbar = () => useNotificationStore((state) => state.snackbar);

// Computed selectors
export const useToastMessage = () => useNotificationStore((state) => state.toasts[0]?.message || '');
export const useToastVisible = () => useNotificationStore((state) => state.toasts.length > 0);
export const useToastType = () => useNotificationStore((state) => state.toasts[0]?.type || 'success');

/**
 * Reset store to initial state (useful for testing)
 */
export const resetNotificationStore = () => {
  // Clear all timeouts
  Object.keys(toastTimeouts).forEach((key) => {
    clearTimeout(toastTimeouts[Number(key)]);
    delete toastTimeouts[Number(key)];
  });
  if (snackbarTimeout) {
    clearTimeout(snackbarTimeout);
    snackbarTimeout = null;
  }
  lastSnackbar = null;
  dismissCooldown = false;

  useNotificationStore.setState({ toasts: [], snackbar: null });
};
