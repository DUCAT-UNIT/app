/**
 * Notification Store (Zustand)
 * Unified snackbar notification system
 *
 * Note: Toasts have been consolidated into snackbars
 */

import { create } from 'zustand';
import { logger } from '../utils/logger';
import { turboGlobal } from '../services/turbo/turboTokenStorage';
import type { SnackbarParams, SnackbarType } from '../types/notification';

// Re-export types
export type { SnackbarType, SnackbarParams } from '../types/notification';

// Default durations by type
const DEFAULT_DURATIONS: Record<SnackbarType, number> = {
  success: 3000,
  error: 5000,
  warning: 5000,
  info: 3000,
  progress: 30000, // Longer for progress states
  pending: 30000,
  submitted: 5000,
};

interface NotificationState {
  snackbar: SnackbarParams | null;
}

interface NotificationActions {
  /**
   * Show a snackbar notification
   */
  showSnackbar: (params: SnackbarParams) => void;

  /**
   * Dismiss the current snackbar
   */
  dismissSnackbar: () => void;

  /**
   * Convenience method for simple informational snackbars
   * Replaces the old showToast API
   */
  showMessage: (title: string, type?: SnackbarType, duration?: number) => void;
}

type NotificationStore = NotificationState & NotificationActions;

// External refs for timeout management (not part of store state)
let snackbarTimeout: NodeJS.Timeout | null = null;
let lastSnackbar: SnackbarParams | null = null;
let dismissCooldown = false;
let snackbarKey = 0;

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  // State
  snackbar: null,

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
      progress: 1,
      submitted: 2,
      success: 3,
      info: 3,
      warning: 3,
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

    // Get duration - use provided, or default based on type
    const duration = snackbarParams.duration ?? DEFAULT_DURATIONS[snackbarParams.type] ?? 5000;

    set({ snackbar: { ...snackbarParams, key: snackbarKey, duration } });

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
      }, duration);
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

  /**
   * Convenience method for simple message snackbars
   * This replaces the old showToast API with a snackbar-based approach
   */
  showMessage: (title: string, type: SnackbarType = 'info', duration?: number) => {
    get().showSnackbar({
      title,
      type,
      duration: duration ?? DEFAULT_DURATIONS[type],
    });
  },
}));

/**
 * Selector hooks for granular subscriptions
 */
export const useSnackbar = () => useNotificationStore((state) => state.snackbar);

/**
 * Reset store to initial state (useful for testing)
 */
export const resetNotificationStore = () => {
  // Clear timeouts
  if (snackbarTimeout) {
    clearTimeout(snackbarTimeout);
    snackbarTimeout = null;
  }
  lastSnackbar = null;
  dismissCooldown = false;

  useNotificationStore.setState({ snackbar: null });
};

/**
 * useNotifications - Backwards-compatible hook
 */
export const useNotifications = () => {
  const store = useNotificationStore();
  return {
    snackbar: store.snackbar,
    showSnackbar: store.showSnackbar,
    dismissSnackbar: store.dismissSnackbar,
    showMessage: store.showMessage,
    // Legacy showToast - maps to showMessage for backwards compatibility
    // Note: Defaults to 'success' to match original toast behavior
    showToast: (message: string, type: SnackbarType = 'success') => {
      store.showMessage(message, type);
    },
  };
};
