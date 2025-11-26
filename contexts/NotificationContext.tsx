/**
 * NotificationContext - Toast and Snackbar notifications
 * Manages all user-facing notifications (toasts and snackbars)
 * Separated from UIContext for better performance and organization
 */

import React, { createContext, useContext, useState, useRef, useMemo, useCallback, ReactNode } from 'react';
import { logger } from '../utils/logger';
import { turboGlobal } from '../services/turbo/turboTokenStorage';
import type { ToastType, Toast, SnackbarType, SnackbarParams } from '../types/notification';

// Re-export types for backwards compatibility
export type { ToastType, Toast, SnackbarType, SnackbarParams } from '../types/notification';

interface NotificationContextValue {
  // Toast
  showToast: (message: string, type?: ToastType) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
  toastMessage: string;
  toastVisible: boolean;
  toastType: ToastType;
  // Snackbar
  showSnackbar: (params: SnackbarParams) => void;
  snackbar: SnackbarParams | null;
  dismissSnackbar: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const useNotifications = (): NotificationContextValue => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

let nextToastId = 0;

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  // ============================================================
  // TOAST NOTIFICATIONS
  // ============================================================
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutsRef = useRef<Record<number, NodeJS.Timeout>>({});

  // Legacy toast function (backwards compatible)
  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    // Clear all existing timeouts
    Object.keys(timeoutsRef.current).forEach((key) => {
      clearTimeout(timeoutsRef.current[Number(key)]);
      delete timeoutsRef.current[Number(key)];
    });

    const id = nextToastId++;
    const duration = type === 'error' ? 3500 : 2000;

    // Replace all toasts with just this new one
    const newToast: Toast = { id, message, type };
    setToasts([newToast]);

    // Auto-hide after duration
    timeoutsRef.current[id] = setTimeout(() => {
      setToasts([]);
      delete timeoutsRef.current[id];
    }, duration);
  }, []);

  const dismissToast = useCallback((id: number) => {
    // Clear timeout
    if (timeoutsRef.current[id]) {
      clearTimeout(timeoutsRef.current[id]);
      delete timeoutsRef.current[id];
    }

    // Remove toast
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // ============================================================
  // SNACKBAR
  // ============================================================
  const [snackbar, setSnackbar] = useState<SnackbarParams | null>(null);
  const lastSnackbarRef = useRef<SnackbarParams | null>(null);
  const snackbarTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dismissCooldownRef = useRef<boolean | null>(null);
  const snackbarKeyRef = useRef(0);

  const showSnackbar = useCallback((snackbarParams: SnackbarParams) => {
    logger.debug('🎯 NotificationContext showSnackbar called with:', snackbarParams);

    // If we just dismissed a snackbar, ignore new ones briefly
    if (dismissCooldownRef.current) {
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
    const last = lastSnackbarRef.current;
    if (last && snackbarParams.action === last.action) {
      // Same action type - check if it's the same transaction
      const sameTx = (snackbarParams.txid && last.txid && snackbarParams.txid === last.txid) ||
                     (!snackbarParams.txid && !last.txid);

      if (sameTx || !snackbarParams.txid || !last.txid) {
        const currentRank = stateRank[snackbarParams.type] || 0;
        const lastRank = stateRank[last.type] || 0;

        // Don't allow going backwards in state (e.g., submitted -> pending)
        if (currentRank < lastRank && snackbarParams.type !== 'error') {
          logger.debug('🎯 Ignoring backward state transition:', last.type, '->', snackbarParams.type);
          return;
        }
      }
    }

    lastSnackbarRef.current = snackbarParams;

    // Increment key to force new component instance
    snackbarKeyRef.current += 1;

    setSnackbar({ ...snackbarParams, key: snackbarKeyRef.current });

    // Auto-dismiss notifications after 7 seconds (unless persistent)
    // Clear any existing timeout first
    if (snackbarTimeoutRef.current) {
      clearTimeout(snackbarTimeoutRef.current);
      snackbarTimeoutRef.current = null;
    }

    // Only auto-dismiss if not persistent
    if (!snackbarParams.persistent) {
      snackbarTimeoutRef.current = setTimeout(() => {
        setSnackbar(null);
        snackbarTimeoutRef.current = null;
      }, 7000); // 7 seconds
    }
  }, []);

  const dismissSnackbar = useCallback(() => {
    // Clear auto-dismiss timeout if exists
    if (snackbarTimeoutRef.current) {
      clearTimeout(snackbarTimeoutRef.current);
      snackbarTimeoutRef.current = null;
    }
    setSnackbar(null);
    lastSnackbarRef.current = null;

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
    dismissCooldownRef.current = true;
    setTimeout(() => {
      dismissCooldownRef.current = null;
    }, 500);
  }, []);

  // ============================================================
  // MEMOIZED VALUE
  // ============================================================
  // Computed values for backwards compatibility
  const toastMessage = useMemo(() => toasts[0]?.message || '', [toasts]);
  const toastVisible = useMemo(() => toasts.length > 0, [toasts]);
  const toastType = useMemo<ToastType>(() => toasts[0]?.type || 'success', [toasts]);

  const value = useMemo(
    () => ({
      // Toast
      showToast,
      toasts,
      dismissToast,
      toastMessage,
      toastVisible,
      toastType,
      // Snackbar
      showSnackbar,
      snackbar,
      dismissSnackbar,
    }),
    [
      showToast,
      toasts,
      dismissToast,
      toastMessage,
      toastVisible,
      toastType,
      showSnackbar,
      snackbar,
      dismissSnackbar,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
