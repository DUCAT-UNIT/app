/**
 * useAppSettings Hook
 * Handles app preferences like notifications and display settings
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authenticateWithBiometrics } from '../services/biometricService';
import { clearWallet } from '../services/cashu/cashuWalletService';

export function useAppSettings({ biometricEnabled, setIsAuthenticated, showToast, showSnackbar }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showZeroAssets, setShowZeroAssets] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [ecashThreshold, setEcashThreshold] = useState(100); // Default 100 UNIT for auto-Turbo
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

        const savedAdvancedMode = await SecureStore.getItemAsync('advancedMode');
        if (savedAdvancedMode !== null) {
          setAdvancedMode(savedAdvancedMode === 'true');
        }

        const savedEcashThreshold = await SecureStore.getItemAsync('ecashThreshold');
        if (savedEcashThreshold !== null) {
          setEcashThreshold(parseInt(savedEcashThreshold, 10));
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

  const handleAdvancedModeToggle = useCallback(async () => {
    console.log('[useAppSettings] Advanced Mode toggle called, current value:', advancedMode);
    const newValue = !advancedMode;
    console.log('[useAppSettings] Setting Advanced Mode to:', newValue);
    setAdvancedMode(newValue);
    await SecureStore.setItemAsync('advancedMode', newValue.toString());
    console.log('[useAppSettings] Advanced Mode toggle complete');
  }, [advancedMode]);

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

  const handleRecoverLockedChange = useCallback(async () => {
    console.log('[useAppSettings] handleRecoverLockedChange called');
    try {
      if (showToast) {
        showToast('Recovering change from sent tokens...', 'info');
      }

      const { recoverLockedChange } = await import('../services/cashu/cashuWalletService.js');
      console.log('[useAppSettings] Calling recoverLockedChange');
      const result = await recoverLockedChange();
      console.log('[useAppSettings] Recovery result:', result);

      if (result.recovered > 0) {
        if (showSnackbar) {
          showSnackbar({
            type: 'success',
            action: 'swap',
            description: `Recovered ${result.amount} UNIT from ${result.recovered} change proofs`,
          });
        }
      } else {
        if (showToast) {
          showToast(result.message, 'info');
        }
      }
    } catch (error) {
      console.error('[useAppSettings] Recovery failed:', error);
      if (showSnackbar) {
        showSnackbar({
          type: 'error',
          action: 'swap',
          description: `Failed to recover change: ${error.message}`,
        });
      }
    }
  }, [showToast, showSnackbar]);

  const handleClearLockedTokens = useCallback(async () => {
    try {
      const { clearSentLockedTokens } = await import('../services/cashu/cashuLockedTokensService.js');
      await clearSentLockedTokens();
      if (showToast) {
        showToast('Sent locked tokens history cleared', 'success');
      }
    } catch (error) {
      if (showToast) {
        showToast('Failed to clear locked tokens history', 'error');
      }
    }
  }, [showToast]);

  const handleEcashThresholdChange = useCallback(async (newThreshold) => {
    console.log('[useAppSettings] Ecash threshold changed to:', newThreshold);
    setEcashThreshold(newThreshold);
    await SecureStore.setItemAsync('ecashThreshold', newThreshold.toString());
  }, []);

  return useMemo(
    () => ({
      notificationsEnabled,
      showZeroAssets,
      advancedMode,
      ecashThreshold,
      handleShowZeroAssetsToggle,
      handleAdvancedModeToggle,
      handleNotificationsToggle,
      handleClearCashuCache,
      handleRecoverLockedChange,
      handleClearLockedTokens,
      handleEcashThresholdChange,
      showNotificationsModal,
      confirmNotificationsToggle,
      cancelNotificationsToggle,
    }),
    [
      notificationsEnabled,
      showZeroAssets,
      advancedMode,
      ecashThreshold,
      handleShowZeroAssetsToggle,
      handleAdvancedModeToggle,
      handleNotificationsToggle,
      handleClearCashuCache,
      handleRecoverLockedChange,
      handleClearLockedTokens,
      handleEcashThresholdChange,
      showNotificationsModal,
      confirmNotificationsToggle,
      cancelNotificationsToggle,
    ]
  );
}
