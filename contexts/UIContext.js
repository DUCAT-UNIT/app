/**
 * UIContext - Global UI state management
 * Consolidates display preferences and toast notifications
 * Provides a single context for all global UI state
 */

import React, { createContext, useContext, useState, useRef, useMemo, useCallback } from 'react';

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
  const { toast } = useUI();
  return toast;
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
  // Computed values for backwards compatibility
  const toastMessage = toasts[0]?.message || '';
  const toastVisible = toasts.length > 0;
  const toastType = toasts[0]?.type || 'success';

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
    }),
    [
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
    ]
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};
