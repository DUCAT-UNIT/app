/**
 * useAppSettings Hook
 * Handles app preferences like notifications and display settings
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { authenticateWithBiometrics } from '../services/biometricService';
import { clearWallet } from '../services/cashu/cashuWalletService';
import {
  getBoolean,
  getNumber,
  SettingKeys,
  setBoolean,
  setNumber,
} from '../services/settingsService';
import { logger } from '../utils/logger';
import { notify } from '../utils/notify';

export interface UseAppSettingsParams {
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
  const [ecashThreshold, setEcashThreshold] = useState(10000); // Default 100 UNIT (10000 cents) for auto-Turbo
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [pendingNotificationsValue, setPendingNotificationsValue] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setNotificationsEnabled(await getBoolean(SettingKeys.NOTIFICATIONS_ENABLED, false));
        setShowZeroAssets(await getBoolean(SettingKeys.SHOW_ZERO_ASSETS, false));
        setAdvancedMode(await getBoolean(SettingKeys.ADVANCED_MODE, false));
        setEcashThreshold(await getNumber(SettingKeys.ECASH_THRESHOLD, 10000));
      } catch (error: unknown) {
        logger.warn('Failed to load app settings', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    };
    loadSettings();
  }, []);

  const persistBooleanOrThrow = useCallback(async (key: string, value: boolean, failureMessage: string) => {
    if (!await setBoolean(key, value)) {
      throw new Error(failureMessage);
    }
  }, []);

  const persistNumberOrThrow = useCallback(async (key: string, value: number, failureMessage: string) => {
    if (!await setNumber(key, value)) {
      throw new Error(failureMessage);
    }
  }, []);

  const handleShowZeroAssetsToggle = useCallback(async () => {
    const newValue = !showZeroAssets;
    setShowZeroAssets(newValue);

    try {
      await persistBooleanOrThrow(
        SettingKeys.SHOW_ZERO_ASSETS,
        newValue,
        'Failed to persist showZeroAssets preference'
      );
    } catch (error: unknown) {
      setShowZeroAssets(!newValue);
      logger.warn('Failed to save showZeroAssets preference', {
        error: error instanceof Error ? error.message : String(error),
        attemptedValue: newValue,
      });
    }
  }, [persistBooleanOrThrow, showZeroAssets]);

  const handleAdvancedModeToggle = useCallback(async () => {
    const newValue = !advancedMode;
    logger.debug('[useAppSettings] Advanced Mode toggle:', advancedMode, '->', newValue);
    setAdvancedMode(newValue);

    try {
      await persistBooleanOrThrow(
        SettingKeys.ADVANCED_MODE,
        newValue,
        'Failed to persist advanced mode preference'
      );
      logger.debug('[useAppSettings] Advanced Mode toggle complete');
    } catch (error: unknown) {
      setAdvancedMode(!newValue);
      logger.warn('Failed to save advanced mode preference', {
        error: error instanceof Error ? error.message : String(error),
        attemptedValue: newValue,
      });
    }
  }, [advancedMode, persistBooleanOrThrow]);

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
            await persistBooleanOrThrow(
              SettingKeys.PENDING_NOTIFICATIONS_ENABLE,
              true,
              'Failed to persist pending notifications flag'
            );
            await persistBooleanOrThrow(
              SettingKeys.RETURN_TO_SETTINGS_AFTER_AUTH,
              true,
              'Failed to persist return-to-settings flag'
            );
            setIsAuthenticated(false);
            return;
          }

          await persistBooleanOrThrow(
            SettingKeys.RETURN_TO_SETTINGS_AFTER_AUTH,
            true,
            'Failed to persist return-to-settings flag'
          );
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          logger.warn('Biometric auth failed for notifications toggle', {
            error: message
          });
          if (message.includes('persist')) {
            notify.settings.notificationsFailed();
          } else {
            notify.auth.requiredForNotifications();
          }
          return;
        }
      } else {
        try {
          await persistBooleanOrThrow(
            SettingKeys.PENDING_NOTIFICATIONS_ENABLE,
            true,
            'Failed to persist pending notifications flag'
          );
          await persistBooleanOrThrow(
            SettingKeys.RETURN_TO_SETTINGS_AFTER_AUTH,
            true,
            'Failed to persist return-to-settings flag'
          );
        } catch (error: unknown) {
          logger.error('Failed to queue notifications enable flow', {
            error: error instanceof Error ? error.message : String(error),
          });
          notify.settings.notificationsFailed();
          return;
        }
        setIsAuthenticated(false);
        return;
      }
    }

    // Authentication successful or disabling, proceed with toggle
    setNotificationsEnabled(newValue);
    try {
      await persistBooleanOrThrow(
        SettingKeys.NOTIFICATIONS_ENABLED,
        newValue,
        'Failed to persist notifications setting'
      );
      if (newValue) {
        notify.settings.notificationsEnabled();
      } else {
        notify.settings.notificationsDisabled();
      }
    } catch (error: unknown) {
      setNotificationsEnabled(!newValue);
      logger.error('Failed to save notification setting', {
        error: error instanceof Error ? error.message : String(error),
        attemptedValue: newValue
      });
      notify.settings.notificationsFailed();
    }
  }, [pendingNotificationsValue, biometricEnabled, persistBooleanOrThrow, setIsAuthenticated]);

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
      const { clearSentLockedTokens } = await import('../services/cashu/cashuLockedTokensService');
      await clearSentLockedTokens();
      notify.cashu.lockedTokensCleared();
    } catch (error) {
      logger.warn('Failed to clear locked tokens', { error: error instanceof Error ? error.message : String(error) });
      notify.cashu.lockedTokensClearFailed();
    }
  }, []);

  const handleEcashThresholdChange = useCallback(async (newThreshold: number): Promise<void> => {
    logger.debug('[useAppSettings] Ecash threshold changed to:', newThreshold);
    const previousThreshold = ecashThreshold;
    setEcashThreshold(newThreshold);
    try {
      await persistNumberOrThrow(
        SettingKeys.ECASH_THRESHOLD,
        newThreshold,
        'Failed to persist ecash threshold'
      );
    } catch (error: unknown) {
      setEcashThreshold(previousThreshold);
      logger.warn('Failed to save ecash threshold', {
        error: error instanceof Error ? error.message : String(error),
        attemptedValue: newThreshold,
      });
    }
  }, [ecashThreshold, persistNumberOrThrow]);

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
