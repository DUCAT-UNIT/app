/**
 * useAppSettings Hook
 * Handles app preferences like notifications and display settings
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authenticateWithBiometrics } from '../services/biometricService';
import { clearWallet } from '../services/cashu/cashuWalletService';
import logger from '../utils/logger';
import { notify } from '../utils/notify';

interface UseAppSettingsParams {
  biometricEnabled: boolean;
  setIsAuthenticated: (value: boolean) => void;
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

export function useAppSettings({ biometricEnabled, setIsAuthenticated }: UseAppSettingsParams): UseAppSettingsReturn {
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
      } catch (error: unknown) {
        logger.warn('Failed to load app settings', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
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
          logger.warn('Biometric auth failed for notifications toggle', {
            error: error instanceof Error ? error.message : String(error)
          });
          notify.auth.requiredForNotifications();
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
      if (newValue) {
        notify.settings.notificationsEnabled();
      } else {
        notify.settings.notificationsDisabled();
      }
    } catch (error: unknown) {
      logger.error('Failed to save notification setting', {
        error: error instanceof Error ? error.message : String(error),
        attemptedValue: newValue
      });
      notify.settings.notificationsFailed();
    }
  }, [pendingNotificationsValue, biometricEnabled, setIsAuthenticated]);

  const cancelNotificationsToggle = useCallback(() => {
    setShowNotificationsModal(false);
  }, []);

  const handleClearCashuCache = useCallback(async () => {
    try {
      await clearWallet();
      notify.cashu.cacheCleared();
    } catch (error) {
      logger.warn('Failed to clear Cashu cache', { error: error instanceof Error ? error.message : String(error) });
      notify.cashu.cacheClearFailed();
    }
  }, []);

  const handleRecoverLockedChange = useCallback(async (): Promise<void> => {
    logger.debug('[useAppSettings] handleRecoverLockedChange called');
    try {
      notify.cashu.recoveringChange();

      const { recoverLockedChange } = await import('../services/cashu/cashuWalletService.js');
      logger.debug('[useAppSettings] Calling recoverLockedChange');
      const result = await recoverLockedChange();
      logger.debug('[useAppSettings] Recovery result:', result);

      if (result.recovered > 0) {
        notify.snackbar({
          title: `Recovered ${result.amount} UNIT from ${result.recovered} change proofs`,
          type: 'success',
          action: 'claim',
        });
      } else {
        notify.info(result.message);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[useAppSettings] Recovery failed:', { error: errorMessage });
      notify.snackbar({
        title: `Failed to recover change: ${errorMessage}`,
        type: 'error',
        action: 'claim',
      });
    }
  }, []);

  const handleClearLockedTokens = useCallback(async (): Promise<void> => {
    try {
      const { clearSentLockedTokens } = await import('../services/cashu/cashuLockedTokensService.js');
      await clearSentLockedTokens();
      notify.cashu.lockedTokensCleared();
    } catch (error) {
      logger.warn('Failed to clear locked tokens', { error: error instanceof Error ? error.message : String(error) });
      notify.cashu.lockedTokensClearFailed();
    }
  }, []);

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
