/**
 * useAppSettings Hook
 * Handles app preferences like notifications and display settings
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authenticateWithBiometrics } from '../services/biometricService';
import { clearWallet } from '../services/cashu/cashuWalletService';

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

  const handleShowZeroAssetsToggle = useCallback(async () => {
    const newValue = !showZeroAssets;
    setShowZeroAssets(newValue);
    await SecureStore.setItemAsync('showZeroAssets', newValue.toString());
  }, [showZeroAssets]);

  const handleNotificationsToggle = useCallback(() => {
    const newValue = !notificationsEnabled;
    setPendingNotificationsValue(newValue);
    setShowNotificationsModal(true);
  }, [notificationsEnabled]);

  const confirmNotificationsToggle = useCallback(async () => {
    setShowNotificationsModal(false);
    const newValue = pendingNotificationsValue;

    // If enabling, require authentication first
    if (newValue) {
      if (biometricEnabled) {
        try {
          const result = await authenticateWithBiometrics(
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
  }, [pendingNotificationsValue, biometricEnabled, setIsAuthenticated, showToast]);

  const cancelNotificationsToggle = useCallback(() => {
    setShowNotificationsModal(false);
  }, []);

  const handleClearCashuCache = useCallback(async () => {
    try {
      await clearWallet();
      if (showToast) {
        showToast('Cashu cache cleared successfully', 'success');
      }
    } catch (error) {
      if (showToast) {
        showToast('Failed to clear Cashu cache', 'error');
      }
    }
  }, [showToast]);

  return useMemo(
    () => ({
      notificationsEnabled,
      showZeroAssets,
      handleShowZeroAssetsToggle,
      handleNotificationsToggle,
      handleClearCashuCache,
      showNotificationsModal,
      confirmNotificationsToggle,
      cancelNotificationsToggle,
    }),
    [
      notificationsEnabled,
      showZeroAssets,
      handleShowZeroAssetsToggle,
      handleNotificationsToggle,
      handleClearCashuCache,
      showNotificationsModal,
      confirmNotificationsToggle,
      cancelNotificationsToggle,
    ]
  );
}
