/**
 * UIContext - Global UI state management (REFACTORED)
 * This is now a wrapper around DisplayPreferencesContext and NotificationContext
 * Provides backwards compatibility while using the new split contexts
 *
 * PERFORMANCE: Split into 2 separate contexts to prevent unnecessary re-renders
 * - DisplayPreferencesContext: Only re-renders when display settings change
 * - NotificationContext: Only re-renders when toasts/snackbars change
 */

import React, { useMemo } from 'react';
import { DisplayPreferencesProvider, useDisplayPreferences } from './DisplayPreferencesContext';
import { NotificationProvider, useNotifications, useToastContext } from './NotificationContext';

// Re-export hooks for backwards compatibility
export { useDisplayPreferences, useToastContext };

// Legacy useUI hook - combines both contexts for backwards compatibility
export const useUI = () => {
  const displayPreferences = useDisplayPreferences();
  const notifications = useNotifications();

  // Combine both contexts for backwards compatibility
  return useMemo(
    () => ({
      // Display preferences namespace
      displayPreferences: {
        showTotalInBTC: displayPreferences.showTotalInBTC,
        setShowTotalInBTC: displayPreferences.setShowTotalInBTC,
        showBTCInBTC: displayPreferences.showBTCInBTC,
        setShowBTCInBTC: displayPreferences.setShowBTCInBTC,
        showUnitInUnit: displayPreferences.showUnitInUnit,
        setShowUnitInUnit: displayPreferences.setShowUnitInUnit,
      },
      // Toast namespace
      toast: {
        showToast: notifications.showToast,
        toasts: notifications.toasts,
        dismissToast: notifications.dismissToast,
        toastMessage: notifications.toastMessage,
        toastVisible: notifications.toastVisible,
        toastType: notifications.toastType,
      },
      // Direct exports for convenience (backwards compatibility)
      showTotalInBTC: displayPreferences.showTotalInBTC,
      setShowTotalInBTC: displayPreferences.setShowTotalInBTC,
      showBTCInBTC: displayPreferences.showBTCInBTC,
      setShowBTCInBTC: displayPreferences.setShowBTCInBTC,
      showUnitInUnit: displayPreferences.showUnitInUnit,
      setShowUnitInUnit: displayPreferences.setShowUnitInUnit,
      showToast: notifications.showToast,
      toasts: notifications.toasts,
      dismissToast: notifications.dismissToast,
      toastMessage: notifications.toastMessage,
      toastVisible: notifications.toastVisible,
      toastType: notifications.toastType,
      // Snackbar exports
      showSnackbar: notifications.showSnackbar,
      snackbar: notifications.snackbar,
      dismissSnackbar: notifications.dismissSnackbar,
    }),
    [displayPreferences, notifications]
  );
};

// UIProvider now wraps both contexts
export const UIProvider = ({ children }) => {
  return (
    <DisplayPreferencesProvider>
      <NotificationProvider>
        {children}
      </NotificationProvider>
    </DisplayPreferencesProvider>
  );
};
