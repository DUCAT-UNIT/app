/**
 * useAppSettings Hook
 * Handles app preferences like notifications and display settings
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authenticateWithBiometrics } from '../services/biometricService';
import { clearWallet } from '../services/cashu/cashuWalletService';
import logger from '../utils/logger';
import type { SnackbarParams, ToastType } from '../contexts/NotificationContext';

interface UseAppSettingsParams {
  biometricEnabled: boolean;
  setIsAuthenticated: (value: boolean) => void;
  showToast?: (message: string, type: ToastType) => void;
  showSnackbar?: (params: SnackbarParams) => void;
}

interface UseAppSettingsReturn {
  notificationsEnabled: boolean;
  showZeroAssets: boolean;
  advancedMode: boolean;
  ecashThreshold: number;
  handleShowZeroAssetsToggle: () => Promise<void>;
  handleAdvancedModeToggle: () => Promise<void>;
  handleNotificationsToggle: () => void;
  handleClearCashuCache: () => Promise<void>;
  handleRecoverLockedChange: () => Promise<void>;
  handleClearLockedTokens: () => Promise<void>;
  handleEcashThresholdChange: (newThreshold: number) => Promise<void>;
  showNotificationsModal: boolean;
  confirmNotificationsToggle: () => Promise<void>;
  cancelNotificationsToggle: () => void;
}

export function useAppSettings({ biometricEnabled, setIsAuthenticated, showToast, showSnackbar }: UseAppSettingsParams): UseAppSettingsReturn {
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
      } catch (error: unknown) {}
    };
    loadSettings();
  }, []);

  const handleShowZeroAssetsToggle = useCallback(async () => {
    const newValue = !showZeroAssets;
    setShowZeroAssets(newValue);
    await SecureStore.setItemAsync('showZeroAssets', newValue.toString());
  }, [showZeroAssets]);

  const handleAdvancedModeToggle = useCallback(async () => {
    logger.debug('[useAppSettings] Advanced Mode toggle called, current value:', advancedMode);
    const newValue = !advancedMode;
    logger.debug('[useAppSettings] Setting Advanced Mode to:', newValue);
    setAdvancedMode(newValue);
    await SecureStore.setItemAsync('advancedMode', newValue.toString());
    logger.debug('[useAppSettings] Advanced Mode toggle complete');
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
        } catch (error: unknown) {
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
      if (showToast) {
        showToast('Failed to clear Cashu cache', 'error');
      }
    }
  }, [showToast]);

  const handleRecoverLockedChange = useCallback(async (): Promise<void> => {
    logger.debug('[useAppSettings] handleRecoverLockedChange called');
    try {
      if (showToast) {
        showToast('Recovering change from sent tokens...', 'info');
      }

      const { recoverLockedChange } = await import('../services/cashu/cashuWalletService.js');
      logger.debug('[useAppSettings] Calling recoverLockedChange');
      const result = await recoverLockedChange();
      logger.debug('[useAppSettings] Recovery result:', result);

      if (result.recovered > 0) {
        if (showSnackbar) {
          showSnackbar({
            message: `Recovered ${result.amount} UNIT from ${result.recovered} change proofs`,
            type: 'success',
            action: 'claim',
          });
        }
      } else {
        if (showToast) {
          showToast(result.message, 'info');
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[useAppSettings] Recovery failed:', { error: errorMessage });
      if (showSnackbar) {
        showSnackbar({
          message: `Failed to recover change: ${errorMessage}`,
          type: 'error',
          action: 'claim',
        });
      }
    }
  }, [showToast, showSnackbar]);

  const handleClearLockedTokens = useCallback(async (): Promise<void> => {
    try {
      const { clearSentLockedTokens } = await import('../services/cashu/cashuLockedTokensService.js');
      await clearSentLockedTokens();
      if (showToast) {
        showToast('Sent locked tokens history cleared', 'success');
      }
    } catch (error: unknown) {
      if (showToast) {
        showToast('Failed to clear locked tokens history', 'error');
      }
    }
  }, [showToast]);

  const handleEcashThresholdChange = useCallback(async (newThreshold: number): Promise<void> => {
    logger.debug('[useAppSettings] Ecash threshold changed to:', newThreshold);
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
