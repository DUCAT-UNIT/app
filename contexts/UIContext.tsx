/**
 * UIContext - Global UI state management (FULLY MIGRATED TO ZUSTAND)
 *
 * MIGRATION COMPLETE: No providers needed - using Zustand stores directly
 * - DisplayPreferences: stores/displayPreferencesStore.ts
 * - Notifications: stores/notificationStore.ts
 *
 * This file now just provides a no-op provider for backwards compatibility
 * and re-exports hooks from the stores.
 */

import React, { ReactNode } from 'react';

// Re-export hooks from stores
export { useDisplayPreferences } from '../stores/displayPreferencesStore';
export { useNotifications } from '../stores/notificationStore';

interface UIProviderProps {
  children: ReactNode;
}

// UIProvider is now a pass-through - Zustand stores don't need providers
export const UIProvider: React.FC<UIProviderProps> = ({ children }) => {
  return <>{children}</>;
};
