/**
 * UIContext - Global UI state management (FULLY MIGRATED)
 * This file now just re-exports the split contexts for convenience
 *
 * PERFORMANCE: Split into 2 separate contexts to prevent unnecessary re-renders
 * - DisplayPreferencesContext: Only re-renders when display settings change
 * - NotificationContext: Only re-renders when toasts/snackbars change
 *
 * MIGRATION COMPLETE: All backwards compatibility removed
 * Components should use useDisplayPreferences() or useNotifications() directly
 */

import React, { ReactNode } from 'react';
import { DisplayPreferencesProvider } from './DisplayPreferencesContext';
import { NotificationProvider } from './NotificationContext';

// Re-export hooks for convenience
export { useDisplayPreferences } from './DisplayPreferencesContext';
export { useNotifications } from './NotificationContext';

interface UIProviderProps {
  children: ReactNode;
}

// UIProvider wraps both contexts
export const UIProvider: React.FC<UIProviderProps> = ({ children }) => {
  return (
    <DisplayPreferencesProvider>
      <NotificationProvider>
        {children}
      </NotificationProvider>
    </DisplayPreferencesProvider>
  );
};
