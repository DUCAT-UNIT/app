/**
 * useAppSettings Hook
 * Handles app preferences like notifications and display settings
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { authenticateWithBiometrics } from '../services/biometricService';
import {
  DEFAULT_AUTO_LOCK_TIMEOUT_MS,
  E2E_AUTO_LOCK_TIMEOUT_MS,
  USDC_FEATURE_UNLOCK_PHRASE,
} from '../constants/settings';
import { clearCashuCache } from '../services/cacheService';
import { getExpoPushToken, unregisterPushToken } from '../services/pushNotificationService';
import { useUsdcFeatureFlagStore } from '../stores/usdcFeatureFlagStore';
import {
  E2E_RESET_SETTINGS_URL_PREFIX,
  resetNonSecretE2ESettings,
} from '../services/e2eSettingsResetService';
import {
  getBoolean,
  getNumber,
  exists,
  SettingKeys,
  setBoolean,
  setNumber,
} from '../services/settingsService';
import { logger } from '../utils/logger';
import { notify } from '../utils/notify';
import { isE2E } from '../utils/e2e';

const normalizeUsdcFeaturePhrase = (phrase: string): string =>
  phrase
    .trim()
    .normalize('NFKC')
    .replace(/[\u2010-\u2015\u2212]/g, '-');

const canonicalizeUsdcFeaturePhrase = (phrase: string): string =>
  normalizeUsdcFeaturePhrase(phrase)
    .replace(/[^a-z0-9]/gi, '')
    .toLocaleLowerCase('en-US');

const formatUnitSmallestAmount = (amount: number): string =>
  (amount / 100).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  });

type LockedChangeRecoveryResult = {
  recovered: number;
  amount: number;
  message: string;
};

export type NotificationsPromptMode = 'settings' | 'onboarding';

const EMPTY_LOCKED_CHANGE_RECOVERY: LockedChangeRecoveryResult = {
  recovered: 0,
  amount: 0,
  message: '',
};

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
  handleEnableUsdcFeatures: (unlockPhrase: string) => Promise<boolean>;
  handleDisableUsdcFeatures: () => Promise<void>;
  showNotificationsModal: boolean;
  notificationsPromptMode: NotificationsPromptMode;
  confirmNotificationsToggle: () => Promise<void>;
  cancelNotificationsToggle: () => void;
  handleOnboardingNotificationsPrompt: () => Promise<void>;
  completeNotificationsEnableAfterAuth: () => Promise<void>;
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
  const [notificationsPromptMode, setNotificationsPromptMode] =
    useState<NotificationsPromptMode>('settings');
  const [pendingNotificationsValue, setPendingNotificationsValue] = useState(false);
  const onboardingNotificationsPromptedRef = useRef(false);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const hasStoredNotificationPreference = await exists(SettingKeys.NOTIFICATIONS_ENABLED);
        let storedNotificationsEnabled = await getBoolean(SettingKeys.NOTIFICATIONS_ENABLED, false);

        if (!hasStoredNotificationPreference) {
          const permissions = await Notifications.getPermissionsAsync();
          if (permissions.status === 'granted') {
            storedNotificationsEnabled = true;
            await setBoolean(SettingKeys.NOTIFICATIONS_ENABLED, true);
          }
        }

        setNotificationsEnabled(storedNotificationsEnabled);
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
    setAutoLockTimeoutMs(E2E_AUTO_LOCK_TIMEOUT_MS);
    setUsdcFeaturesEnabled(false);
    useUsdcFeatureFlagStore.getState().setEnabled(false);

    await resetNonSecretE2ESettings();
  }, []);

  useEffect(() => {
    if (!__DEV__) return undefined;

    if (typeof Linking.addEventListener !== 'function') return undefined;

    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url?.startsWith(E2E_RESET_SETTINGS_URL_PREFIX)) {
        resetE2ESettings().catch((error: unknown) => {
          logger.warn('Failed to reset E2E settings', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
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
    setNotificationsPromptMode('settings');
    setShowNotificationsModal(true);
  }, [notificationsEnabled]);

  const enableNotificationsPreference = useCallback(async (): Promise<boolean> => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        setNotificationsEnabled(false);
        await persistBooleanOrThrow(
          SettingKeys.NOTIFICATIONS_ENABLED,
          false,
          'Failed to persist notifications setting'
        );
        notify.settings.notificationsFailed();
        return false;
      }

      setNotificationsEnabled(true);
      await persistBooleanOrThrow(
        SettingKeys.NOTIFICATIONS_ENABLED,
        true,
        'Failed to persist notifications setting'
      );
      notify.settings.notificationsEnabled();
      return true;
    } catch (error: unknown) {
      setNotificationsEnabled(false);
      logger.error('Failed to enable notifications', {
        error: error instanceof Error ? error.message : String(error),
      });
      notify.settings.notificationsFailed();
      return false;
    }
  }, [persistBooleanOrThrow]);

  const completeNotificationsEnableAfterAuth = useCallback(async (): Promise<void> => {
    await enableNotificationsPreference();
  }, [enableNotificationsPreference]);

  const handleOnboardingNotificationsPrompt = useCallback(async (): Promise<void> => {
    if (
      isE2E() ||
      onboardingNotificationsPromptedRef.current ||
      notificationsEnabled ||
      showNotificationsModal
    ) {
      return;
    }

    onboardingNotificationsPromptedRef.current = true;

    try {
      const hasStoredNotificationPreference = await exists(SettingKeys.NOTIFICATIONS_ENABLED);
      if (hasStoredNotificationPreference) {
        return;
      }

      const permissions = await Notifications.getPermissionsAsync();
      if (permissions.status === 'granted') {
        await enableNotificationsPreference();
        return;
      }

      setPendingNotificationsValue(true);
      setNotificationsPromptMode('onboarding');
      setShowNotificationsModal(true);
    } catch (error: unknown) {
      logger.warn('Failed to prepare onboarding notification prompt', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [enableNotificationsPreference, notificationsEnabled, showNotificationsModal]);

  const confirmNotificationsToggle = useCallback(async () => {
    setShowNotificationsModal(false);
    const newValue = pendingNotificationsValue;

    if (notificationsPromptMode === 'onboarding') {
      setNotificationsPromptMode('settings');
      if (newValue) {
        await enableNotificationsPreference();
      }
      return;
    }

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

          await enableNotificationsPreference();
          return;
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
      if (!newValue) {
        const token = await getExpoPushToken({ requestPermissions: false });
        if (token) {
          await unregisterPushToken(token);
        }
      }
      notify.settings.notificationsDisabled();
    } catch (error: unknown) {
      setNotificationsEnabled(!newValue);
      logger.error('Failed to save notification setting', {
        error: error instanceof Error ? error.message : String(error),
        attemptedValue: newValue,
      });
      notify.settings.notificationsFailed();
    }
  }, [
    pendingNotificationsValue,
    notificationsPromptMode,
    biometricEnabled,
    persistBooleanOrThrow,
    setIsAuthenticated,
    enableNotificationsPreference,
  ]);

  const cancelNotificationsToggle = useCallback(() => {
    if (notificationsPromptMode === 'onboarding') {
      persistBooleanOrThrow(
        SettingKeys.NOTIFICATIONS_ENABLED,
        false,
        'Failed to persist notifications setting'
      ).catch((error: unknown) => {
        logger.warn('Failed to persist skipped onboarding notification prompt', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
      setNotificationsPromptMode('settings');
    }
    setShowNotificationsModal(false);
  }, [notificationsPromptMode, persistBooleanOrThrow]);

  const handleClearCashuCache = useCallback(async () => {
    try {
      await clearCashuCache();
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

      const { recoverLockedChange } = await Promise.resolve().then(
        () =>
          require('../services/cashu/cashuWalletService') as typeof import('../services/cashu/cashuWalletService')
      );
      logger.debug('[useAppSettings] Calling recoverLockedChange');
      const [unitRecovery, satRecovery] = await Promise.allSettled([
        recoverLockedChange('unit'),
        recoverLockedChange('sat'),
      ]);
      const unitResult =
        unitRecovery.status === 'fulfilled' ? unitRecovery.value : EMPTY_LOCKED_CHANGE_RECOVERY;
      const satResult =
        satRecovery.status === 'fulfilled' ? satRecovery.value : EMPTY_LOCKED_CHANGE_RECOVERY;
      logger.debug('[useAppSettings] Recovery result:', { unitResult, satResult });

      const recovered = unitResult.recovered + satResult.recovered;
      const recoveryErrors = [unitRecovery, satRecovery]
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) =>
          result.reason instanceof Error ? result.reason.message : String(result.reason)
        );
      if (recovered > 0) {
        const parts = [
          unitResult.recovered > 0 ? `${formatUnitSmallestAmount(unitResult.amount)} UNIT` : null,
          satResult.recovered > 0 ? `${satResult.amount} sats` : null,
        ].filter(Boolean);
        if (recoveryErrors.length > 0) {
          logger.warn('[useAppSettings] Some locked change recovery checks failed', {
            errors: recoveryErrors,
          });
        }
        notify.snackbar({
          title: `Recovered ${parts.join(' and ')} from ${recovered} change proofs`,
          type: 'success',
          action: 'claim',
        });
      } else if (recoveryErrors.length > 0) {
        throw new Error(recoveryErrors.join('; '));
      } else {
        notify.info('No change proofs found in Turbo UNIT or Turbo BTC sent tokens');
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
      const { clearLockedTokensHistory } = await import(
        '../services/cashu/cashuLockedTokensService'
      );
      await clearLockedTokensHistory();
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
    async (unlockPhrase: string): Promise<boolean> => {
      const normalizedPhrase = normalizeUsdcFeaturePhrase(unlockPhrase);
      const expectedPhrase = normalizeUsdcFeaturePhrase(USDC_FEATURE_UNLOCK_PHRASE);
      const canonicalPhrase = canonicalizeUsdcFeaturePhrase(unlockPhrase);
      const expectedCanonicalPhrase = canonicalizeUsdcFeaturePhrase(USDC_FEATURE_UNLOCK_PHRASE);
      if (normalizedPhrase !== expectedPhrase && canonicalPhrase !== expectedCanonicalPhrase) {
        notify.error('Incorrect USDC unlock phrase');
        return false;
      }

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
    [persistBooleanOrThrow]
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
      notificationsPromptMode,
      confirmNotificationsToggle,
      cancelNotificationsToggle,
      handleOnboardingNotificationsPrompt,
      completeNotificationsEnableAfterAuth,
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
      notificationsPromptMode,
      confirmNotificationsToggle,
      cancelNotificationsToggle,
      handleOnboardingNotificationsPrompt,
      completeNotificationsEnableAfterAuth,
    ]
  );
}
