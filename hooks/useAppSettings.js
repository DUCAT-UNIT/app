/**
 * useAppSettings Hook
 * Handles app preferences like notifications and display settings
 */

import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as AuthService from '../services/authService';

export function useAppSettings({ biometricEnabled, setIsAuthenticated, showToast }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showZeroAssets, setShowZeroAssets] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [pendingNotificationsValue, setPendingNotificationsValue] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedNotificationsEnabled = await SecureStore.getItemAsync('notificationsEnabled');
        if (savedNotificationsEnabled !== null) {
          setNotificationsEnabled(savedNotificationsEnabled === 'true');
        }

        const savedShowZeroAssets = await SecureStore.getItemAsync('showZeroAssets');
        if (savedShowZeroAssets !== null) {
          setShowZeroAssets(savedShowZeroAssets === 'true');
        }
      } catch (error) {}
    };
    loadSettings();
  }, []);

  const handleShowZeroAssetsToggle = async () => {
    const newValue = !showZeroAssets;
    setShowZeroAssets(newValue);
    await SecureStore.setItemAsync('showZeroAssets', newValue.toString());
  };

  const handleNotificationsToggle = () => {
    const newValue = !notificationsEnabled;
    setPendingNotificationsValue(newValue);
    setShowNotificationsModal(true);
  };

  const confirmNotificationsToggle = async () => {
    setShowNotificationsModal(false);
    const newValue = pendingNotificationsValue;

    // If enabling, require authentication first
    if (newValue) {
      if (biometricEnabled) {
        try {
          const result = await AuthService.authenticateWithBiometrics(
            'Authenticate to enable notifications',
            'Use PIN'
          );

          if (!result.success) {
            await SecureStore.setItemAsync('pendingNotificationsEnable', 'true');
            await SecureStore.setItemAsync('returnToSettingsAfterAuth', 'true');
            setIsAuthenticated(false);
            return;
          }

          await SecureStore.setItemAsync('returnToSettingsAfterAuth', 'true');
        } catch (error) {
          if (showToast) {
            showToast('Authentication required to enable notifications', 'error');
          }
          return;
        }
      } else {
        await SecureStore.setItemAsync('pendingNotificationsEnable', 'true');
        await SecureStore.setItemAsync('returnToSettingsAfterAuth', 'true');
        setIsAuthenticated(false);
        return;
      }
    }

    // Authentication successful or disabling, proceed with toggle
    setNotificationsEnabled(newValue);
    try {
      await SecureStore.setItemAsync('notificationsEnabled', String(newValue));
      if (showToast) {
        showToast(`Notifications ${newValue ? 'enabled' : 'disabled'}`, 'success');
      }
    } catch (error) {
      if (showToast) {
        showToast('Failed to update notifications setting', 'error');
      }
    }
  };

  const cancelNotificationsToggle = () => {
    setShowNotificationsModal(false);
  };

  return {
    notificationsEnabled,
    showZeroAssets,
    handleShowZeroAssetsToggle,
    handleNotificationsToggle,
    showNotificationsModal,
    confirmNotificationsToggle,
    cancelNotificationsToggle,
  };
}
