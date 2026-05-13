/**
 * useNotificationsPreference Hook
 * Simple hook for loading the notifications enabled preference from SecureStore
 * Used by AppNavigator to pass the initial preference to providers
 */

import { useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import {
  exists,
  getNotificationsEnabled,
  setNotificationsEnabled as persistNotificationsEnabled,
  SettingKeys,
} from '../services/settingsService';
import { getExpoPushToken, unregisterPushToken } from '../services/pushNotificationService';

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
        const hasStoredPreference = await exists(SettingKeys.NOTIFICATIONS_ENABLED);
        let enabled = await getNotificationsEnabled();

        if (!hasStoredPreference) {
          const permissions = await Notifications.getPermissionsAsync();
          if (permissions.status === 'granted') {
            enabled = true;
            await persistNotificationsEnabled(true);
          }
        }

        if (hasStoredPreference && !enabled) {
          const token = await getExpoPushToken({ requestPermissions: false });
          if (token) {
            await unregisterPushToken(token);
          }
        }

        setNotificationsEnabled(enabled);
      } finally {
        setIsLoading(false);
      }
    };
    loadNotificationsPreference();
  }, []);

  return { notificationsEnabled, isLoading };
}
