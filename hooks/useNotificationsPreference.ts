/**
 * useNotificationsPreference Hook
 * Simple hook for loading the notifications enabled preference from SecureStore
 * Used by AppNavigator to pass the initial preference to providers
 */

import { useState, useEffect } from 'react';
import { getNotificationsEnabled } from '../services/settingsService';

interface UseNotificationsPreferenceReturn {
  notificationsEnabled: boolean;
  isLoading: boolean;
}

/**
 * Load the notifications preference from secure storage
 * @returns Object with notificationsEnabled state and loading state
 */
export function useNotificationsPreference(): UseNotificationsPreferenceReturn {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadNotificationsPreference = async () => {
      try {
        setNotificationsEnabled(await getNotificationsEnabled());
      } finally {
        setIsLoading(false);
      }
    };
    loadNotificationsPreference();
  }, []);

  return { notificationsEnabled, isLoading };
}
