/**
 * NotificationContext - MIGRATED TO ZUSTAND
 *
 * This file provides backward compatibility by wrapping the Zustand store.
 * New code should import directly from stores/notificationStore.ts
 *
 * MIGRATION STATUS: Complete
 * - Provider is now a no-op (children pass-through)
 * - Hook returns Zustand store values with compatible interface
 * - showToast is now mapped to showSnackbar (unified notification system)
 */

import React, { ReactNode, useCallback } from 'react';
import { useNotificationStore } from '../stores/notificationStore';
import type { SnackbarParams, SnackbarType } from '../types/notification';

// Re-export types for backwards compatibility
export type { SnackbarType, SnackbarParams } from '../types/notification';

interface NotificationContextValue {
  /**
   * @deprecated Use showSnackbar instead. This now maps to showSnackbar internally.
   */
  showToast: (message: string, type?: SnackbarType) => void;
  /**
   * Show a snackbar notification
   */
  showSnackbar: (params: SnackbarParams) => void;
  /**
   * Current snackbar params (null if none showing)
   */
  snackbar: SnackbarParams | null;
  /**
   * Dismiss the current snackbar
   */
  dismissSnackbar: () => void;
}

/**
 * Hook that provides backward-compatible interface to Zustand store
 * Uses selective subscriptions for optimal performance
 */
export const useNotifications = (): NotificationContextValue => {
  // Subscribe to individual state slices for optimal re-renders
  const snackbar = useNotificationStore((state) => state.snackbar);
  const showSnackbar = useNotificationStore((state) => state.showSnackbar);
  const dismissSnackbar = useNotificationStore((state) => state.dismissSnackbar);
  const showMessage = useNotificationStore((state) => state.showMessage);

  /**
   * Backwards-compatible showToast that maps to showSnackbar
   * @deprecated Use showSnackbar instead
   */
  const showToast = useCallback((message: string, type: SnackbarType = 'success') => {
    showMessage(message, type);
  }, [showMessage]);

  return {
    showToast,
    showSnackbar,
    snackbar,
    dismissSnackbar,
  };
};

interface NotificationProviderProps {
  children: ReactNode;
}

/**
 * Provider is now a pass-through - Zustand doesn't need providers!
 * Kept for backward compatibility with existing component tree
 */
export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  // No provider needed - Zustand store is globally accessible
  return <>{children}</>;
};
