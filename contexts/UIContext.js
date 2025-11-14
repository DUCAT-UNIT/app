/**
 * UIContext - Global UI state management
 * Consolidates display preferences and toast notifications
 * Provides a single context for all global UI state
 */

import React, { createContext, useContext, useState, useRef, useMemo, useCallback } from 'react';
import { logger } from '../utils/logger';

const UIContext = createContext();

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};

// Backwards compatibility hooks
export const useDisplayPreferences = () => {
  const { displayPreferences } = useUI();
  return displayPreferences;
};

export const useToastContext = () => {
  const context = useUI();

  // Return all toast and snackbar functions directly from context
  // This ensures backwards compatibility while including all new features
  return {
    // Toast functions (legacy)
    showToast: context.showToast,
    toasts: context.toasts,
    dismissToast: context.dismissToast,
    toastMessage: context.toastMessage,
    toastVisible: context.toastVisible,
    toastType: context.toastType,
    // Snackbar function (new)
    showSnackbar: context.showSnackbar,
    snackbar: context.snackbar,
    dismissSnackbar: context.dismissSnackbar,
  };
};

let nextToastId = 0;

export const UIProvider = ({ children }) => {
  // ============================================================
  // DISPLAY PREFERENCES
  // ============================================================
  const [showTotalInBTC, setShowTotalInBTC] = useState(false);
  const [showBTCInBTC, setShowBTCInBTC] = useState(false);
  const [showUnitInUnit, setShowUnitInUnit] = useState(false);

  // ============================================================
  // TOAST NOTIFICATIONS
  // ============================================================
  const [toasts, setToasts] = useState([]);
  const timeoutsRef = useRef({});

  // ============================================================
  // SNACKBAR (NEW)
  // ============================================================
  const [snackbar, setSnackbar] = useState(null);
  const lastSnackbarRef = useRef(null);

  const showSnackbar = useCallback((snackbarParams) => {
    logger.debug('🎯 UIContext showSnackbar called with:', snackbarParams);

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
  // CONSOLIDATED VALUE (MEMOIZED)
  // ============================================================
  // Memoize the value object to prevent unnecessary re-renders
  // Computed values for backwards compatibility - memoized with toasts dependency
  const toastMessage = useMemo(() => toasts[0]?.message || '', [toasts]);
  const toastVisible = useMemo(() => toasts.length > 0, [toasts]);
  const toastType = useMemo(() => toasts[0]?.type || 'success', [toasts]);

  const value = useMemo(
    () => ({
      // Display preferences namespace
      displayPreferences: {
        showTotalInBTC,
        setShowTotalInBTC,
        showBTCInBTC,
        setShowBTCInBTC,
        showUnitInUnit,
        setShowUnitInUnit,
      },
      // Toast namespace
      toast: {
        showToast,
        toasts,
        dismissToast,
        // Legacy props for backwards compatibility
        toastMessage,
        toastVisible,
        toastType,
      },
      // Direct exports for convenience (backwards compatibility)
      showTotalInBTC,
      setShowTotalInBTC,
      showBTCInBTC,
      setShowBTCInBTC,
      showUnitInUnit,
      setShowUnitInUnit,
      showToast,
      toasts,
      dismissToast,
      toastMessage,
      toastVisible,
      toastType,
      // Snackbar exports
      showSnackbar,
      snackbar,
      dismissSnackbar,
    }),
    [
      showTotalInBTC,
      showBTCInBTC,
      showUnitInUnit,
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

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};
