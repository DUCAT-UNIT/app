/**
 * useAppSettings Hook
 * Handles app preferences like notifications and display settings
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Linking } from 'react-native';
import { authenticateWithBiometrics } from '../services/biometricService';
import { DEFAULT_AUTO_LOCK_TIMEOUT_MS, USDC_FEATURE_PASSWORD } from '../constants/settings';
import { clearWallet } from '../services/cashu/cashuWalletService';
import { useUsdcFeatureFlagStore } from '../stores/usdcFeatureFlagStore';
import {
  E2E_RESET_SETTINGS_URL_PREFIX,
  hasActiveE2EBypass,
  resetNonSecretE2ESettings,
} from '../services/e2eSettingsResetService';
import {
  getBoolean,
  getNumber,
  SettingKeys,
  setBoolean,
  setNumber,
} from '../services/settingsService';
import { logger } from '../utils/logger';
import { notify } from '../utils/notify';

const normalizeUsdcFeaturePassword = (password: string): string =>
  password
    .trim()
    .normalize('NFKC')
    .replace(/[\u2010-\u2015\u2212]/g, '-');

const canonicalizeUsdcFeaturePassword = (password: string): string =>
  normalizeUsdcFeaturePassword(password)
    .replace(/[^a-z0-9]/gi, '')
    .toLocaleLowerCase('en-US');

export interface UseAppSettingsParams {
  biometricEnabled: boolean;
  setIsAuthenticated: (value: boolean) => void;
}

interface UseAppSettingsReturn {
  notificationsEnabled: boolean;
  showZeroAssets: boolean;
  advancedMode: boolean;
  ecashThreshold: number;
  autoLockTimeoutMs: number;
  usdcFeaturesEnabled: boolean;
  handleShowZeroAssetsToggle: () => Promise<void>;
  handleAdvancedModeToggle: () => Promise<void>;
  handleNotificationsToggle: () => void;
  handleClearCashuCache: () => Promise<void>;
  handleRecoverLockedChange: () => Promise<void>;
  handleClearLockedTokens: () => Promise<void>;
  handleEcashThresholdChange: (newThreshold: number) => Promise<void>;
  handleAutoLockTimeoutChange: (timeoutMs: number) => Promise<void>;
  handleEnableUsdcFeatures: (password: string) => Promise<boolean>;
  handleDisableUsdcFeatures: () => Promise<void>;
  showNotificationsModal: boolean;
  confirmNotificationsToggle: () => Promise<void>;
  cancelNotificationsToggle: () => void;
}

export function useAppSettings({
  biometricEnabled,
  setIsAuthenticated,
}: UseAppSettingsParams): UseAppSettingsReturn {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showZeroAssets, setShowZeroAssets] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [ecashThreshold, setEcashThreshold] = useState(10000); // Default 100 UNIT (10000 cents) for auto-Turbo
  const [autoLockTimeoutMs, setAutoLockTimeoutMs] = useState(DEFAULT_AUTO_LOCK_TIMEOUT_MS);
  const [usdcFeaturesEnabled, setUsdcFeaturesEnabled] = useState(false);
  const mirroredUsdcFeaturesEnabled = useUsdcFeatureFlagStore((state) => state.enabled);
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
        setAutoLockTimeoutMs(
          await getNumber(SettingKeys.AUTO_LOCK_TIMEOUT, DEFAULT_AUTO_LOCK_TIMEOUT_MS)
        );
        const storedUsdcFeaturesEnabled = await getBoolean(
          SettingKeys.USDC_FEATURES_ENABLED,
          false
        );
        setUsdcFeaturesEnabled(storedUsdcFeaturesEnabled);
        useUsdcFeatureFlagStore.getState().setEnabled(storedUsdcFeaturesEnabled);
      } catch (error: unknown) {
        logger.warn('Failed to load app settings', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    setUsdcFeaturesEnabled(mirroredUsdcFeaturesEnabled);
  }, [mirroredUsdcFeaturesEnabled]);

  const persistBooleanOrThrow = useCallback(
    async (key: string, value: boolean, failureMessage: string) => {
      if (!(await setBoolean(key, value))) {
        throw new Error(failureMessage);
      }
    },
    []
  );

  const persistNumberOrThrow = useCallback(
    async (key: string, value: number, failureMessage: string) => {
      if (!(await setNumber(key, value))) {
        throw new Error(failureMessage);
      }
    },
    []
  );

  const resetE2ESettings = useCallback(async (): Promise<void> => {
    if (!__DEV__) return;

    setNotificationsEnabled(false);
    setShowZeroAssets(false);
    setAdvancedMode(false);
    setEcashThreshold(10000);
    setAutoLockTimeoutMs(DEFAULT_AUTO_LOCK_TIMEOUT_MS);
    setUsdcFeaturesEnabled(false);
    useUsdcFeatureFlagStore.getState().setEnabled(false);

    await resetNonSecretE2ESettings();
  }, []);

  useEffect(() => {
    if (!__DEV__) return undefined;

    if (typeof Linking.addEventListener !== 'function') return undefined;

    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url?.startsWith(E2E_RESET_SETTINGS_URL_PREFIX)) {
        void resetE2ESettings();
      }
    });

    return () => subscription?.remove?.();
  }, [resetE2ESettings]);

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
            error: message,
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
        attemptedValue: newValue,
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
      logger.warn('Failed to clear Cashu cache', {
        error: error instanceof Error ? error.message : String(error),
      });
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
      logger.warn('Failed to clear locked tokens', {
        error: error instanceof Error ? error.message : String(error),
      });
      notify.cashu.lockedTokensClearFailed();
    }
  }, []);

  const handleEcashThresholdChange = useCallback(
    async (newThreshold: number): Promise<void> => {
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
    },
    [ecashThreshold, persistNumberOrThrow]
  );

  const handleAutoLockTimeoutChange = useCallback(
    async (newTimeoutMs: number): Promise<void> => {
      const previousTimeout = autoLockTimeoutMs;
      setAutoLockTimeoutMs(newTimeoutMs);
      try {
        await persistNumberOrThrow(
          SettingKeys.AUTO_LOCK_TIMEOUT,
          newTimeoutMs,
          'Failed to persist auto-lock timeout'
        );
        notify.success('Auto-lock time updated');
      } catch (error: unknown) {
        setAutoLockTimeoutMs(previousTimeout);
        logger.warn('Failed to save auto-lock timeout', {
          error: error instanceof Error ? error.message : String(error),
          attemptedValue: newTimeoutMs,
        });
        notify.settings.failed('auto-lock time');
      }
    },
    [autoLockTimeoutMs, persistNumberOrThrow]
  );

  const handleEnableUsdcFeatures = useCallback(
    async (password: string): Promise<boolean> => {
      if (!__DEV__ && !hasActiveE2EBypass()) {
        notify.error('USDC features are not enabled in this build');
        return false;
      }

      const normalizedPassword = normalizeUsdcFeaturePassword(password);
      const expectedPassword = normalizeUsdcFeaturePassword(USDC_FEATURE_PASSWORD);
      const canonicalPassword = canonicalizeUsdcFeaturePassword(password);
      const expectedCanonicalPassword = canonicalizeUsdcFeaturePassword(USDC_FEATURE_PASSWORD);
      const allowDevelopmentAutomationBypass =
        normalizedPassword.length === 0 && hasActiveE2EBypass();
      if (
        !allowDevelopmentAutomationBypass &&
        normalizedPassword !== expectedPassword &&
        canonicalPassword !== expectedCanonicalPassword
      ) {
        notify.error('Incorrect Enable USDC password');
        return false;
      }

      const previousValue = usdcFeaturesEnabled;
      setUsdcFeaturesEnabled(true);
      useUsdcFeatureFlagStore.getState().setEnabled(true);
      try {
        await persistBooleanOrThrow(
          SettingKeys.USDC_FEATURES_ENABLED,
          true,
          'Failed to persist USDC feature flag'
        );
        notify.success('USDC features enabled');
        return true;
      } catch (error: unknown) {
        logger.warn('Failed to enable USDC features', {
          error: error instanceof Error ? error.message : String(error),
        });
        notify.settings.failed('USDC features');
        return true;
      }
    },
    [persistBooleanOrThrow, usdcFeaturesEnabled]
  );

  const handleDisableUsdcFeatures = useCallback(async (): Promise<void> => {
    const previousValue = usdcFeaturesEnabled;
    setUsdcFeaturesEnabled(false);
    useUsdcFeatureFlagStore.getState().setEnabled(false);
    try {
      await persistBooleanOrThrow(
        SettingKeys.USDC_FEATURES_ENABLED,
        false,
        'Failed to persist USDC feature flag'
      );
      notify.success('USDC features disabled');
    } catch (error: unknown) {
      setUsdcFeaturesEnabled(previousValue);
      useUsdcFeatureFlagStore.getState().setEnabled(previousValue);
      logger.warn('Failed to disable USDC features', {
        error: error instanceof Error ? error.message : String(error),
      });
      notify.settings.failed('USDC features');
    }
  }, [persistBooleanOrThrow, usdcFeaturesEnabled]);

  return useMemo(
    () => ({
      notificationsEnabled,
      showZeroAssets,
      advancedMode,
      ecashThreshold,
      autoLockTimeoutMs,
      usdcFeaturesEnabled,
      handleShowZeroAssetsToggle,
      handleAdvancedModeToggle,
      handleNotificationsToggle,
      handleClearCashuCache,
      handleRecoverLockedChange,
      handleClearLockedTokens,
      handleEcashThresholdChange,
      handleAutoLockTimeoutChange,
      handleEnableUsdcFeatures,
      handleDisableUsdcFeatures,
      showNotificationsModal,
      confirmNotificationsToggle,
      cancelNotificationsToggle,
    }),
    [
      notificationsEnabled,
      showZeroAssets,
      advancedMode,
      ecashThreshold,
      autoLockTimeoutMs,
      usdcFeaturesEnabled,
      handleShowZeroAssetsToggle,
      handleAdvancedModeToggle,
      handleNotificationsToggle,
      handleClearCashuCache,
      handleRecoverLockedChange,
      handleClearLockedTokens,
      handleEcashThresholdChange,
      handleAutoLockTimeoutChange,
      handleEnableUsdcFeatures,
      handleDisableUsdcFeatures,
      showNotificationsModal,
      confirmNotificationsToggle,
      cancelNotificationsToggle,
    ]
  );
}
