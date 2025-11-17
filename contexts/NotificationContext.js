/**
 * NotificationContext - Toast and Snackbar notifications
 * Manages all user-facing notifications (toasts and snackbars)
 * Separated from UIContext for better performance and organization
 */

import React, { createContext, useContext, useState, useRef, useMemo, useCallback } from 'react';
import { logger } from '../utils/logger';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

let nextToastId = 0;

export const NotificationProvider = ({ children }) => {
  // ============================================================
  // TOAST NOTIFICATIONS
  // ============================================================
  const [toasts, setToasts] = useState([]);
  const timeoutsRef = useRef({});

  // Legacy toast function (backwards compatible)
  const showToast = useCallback((message, type = 'success') => {
    // Clear all existing timeouts
    Object.keys(timeoutsRef.current).forEach((key) => {
      clearTimeout(timeoutsRef.current[key]);
      delete timeoutsRef.current[key];
    });

    const id = nextToastId++;
    const duration = type === 'error' ? 3500 : 2000;

    // Replace all toasts with just this new one
    const newToast = { id, message, type };
    setToasts([newToast]);

    // Auto-hide after duration
    timeoutsRef.current[id] = setTimeout(() => {
      setToasts([]);
      delete timeoutsRef.current[id];
    }, duration);
  }, []);

  const dismissToast = useCallback((id) => {
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
  const [snackbar, setSnackbar] = useState(null);
  const lastSnackbarRef = useRef(null);

  const showSnackbar = useCallback((snackbarParams) => {
    logger.debug('🎯 NotificationContext showSnackbar called with:', snackbarParams);

    // Define state hierarchy: pending < submitted < success
    const stateRank = {
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
    setSnackbar(snackbarParams);
  }, []);

  const dismissSnackbar = useCallback(() => {
    setSnackbar(null);
    // Don't reset lastSnackbarRef - keep tracking state even after dismissal
  }, []);

  // ============================================================
  // MEMOIZED VALUE
  // ============================================================
  // Computed values for backwards compatibility
  const toastMessage = useMemo(() => toasts[0]?.message || '', [toasts]);
  const toastVisible = useMemo(() => toasts.length > 0, [toasts]);
  const toastType = useMemo(() => toasts[0]?.type || 'success', [toasts]);

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
