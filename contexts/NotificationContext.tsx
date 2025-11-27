/**
 * NotificationContext - MIGRATED TO ZUSTAND
 *
 * This file now provides backward compatibility by wrapping the Zustand store.
 * New code should import directly from stores/notificationStore.ts
 *
 * MIGRATION STATUS: Complete
 * - Provider is now a no-op (children pass-through)
 * - Hook returns Zustand store values with compatible interface
 */

import React, { ReactNode } from 'react';
import { useNotificationStore } from '../stores/notificationStore';
import type { ToastType, Toast, SnackbarParams } from '../types/notification';

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

/**
 * Hook that provides backward-compatible interface to Zustand store
 * Uses selective subscriptions for optimal performance
 */
export const useNotifications = (): NotificationContextValue => {
  // Subscribe to individual state slices for optimal re-renders
  const toasts = useNotificationStore((state) => state.toasts);
  const snackbar = useNotificationStore((state) => state.snackbar);
  const showToast = useNotificationStore((state) => state.showToast);
  const dismissToast = useNotificationStore((state) => state.dismissToast);
  const showSnackbar = useNotificationStore((state) => state.showSnackbar);
  const dismissSnackbar = useNotificationStore((state) => state.dismissSnackbar);

  // Computed values for backwards compatibility
  const toastMessage = toasts[0]?.message || '';
  const toastVisible = toasts.length > 0;
  const toastType: ToastType = toasts[0]?.type || 'success';

  return {
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
