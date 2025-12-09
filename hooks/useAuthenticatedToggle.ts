/**
 * useAuthenticatedToggle Hook
 * Reusable hook for settings that require authentication to enable
 * Handles modal confirmation, authentication flow, and persistence
 */

import { useState, useCallback, useMemo } from 'react';
import { authenticateWithBiometrics } from '../services/biometricService';
import * as SettingsService from '../services/settingsService';
import { notify } from '../utils/notify';
import { logger } from '../utils/logger';

interface AuthenticatedToggleConfig {
  settingKey: string;
  settingName: string;
  currentValue: boolean;
  onValueChange?: (newValue: boolean) => void;
  biometricEnabled: boolean;
  setIsAuthenticated: (value: boolean) => void;
  pendingEnableKey?: string;
  authPrompt?: string;
  requireAuthToDisable?: boolean;
}

interface AuthenticatedToggleReturn {
  showModal: boolean;
  handleToggle: () => void;
  confirmToggle: () => Promise<void>;
  cancelToggle: () => void;
}

interface AuthContext {
  biometricEnabled: boolean;
  setIsAuthenticated: (value: boolean) => void;
}

export function useAuthenticatedToggle(config: AuthenticatedToggleConfig): AuthenticatedToggleReturn {
  const {
    settingKey,
    settingName,
    currentValue,
    onValueChange,
    biometricEnabled,
    setIsAuthenticated,
    pendingEnableKey,
    authPrompt,
    requireAuthToDisable = false,
  } = config;

  const [showModal, setShowModal] = useState(false);
  const [pendingValue, setPendingValue] = useState(false);

  /**
   * Initiate toggle - shows confirmation modal
   */
  const handleToggle = useCallback(() => {
    const newValue = !currentValue;
    setPendingValue(newValue);
    setShowModal(true);
  }, [currentValue]);

  /**
   * Confirm toggle - handles authentication if needed
   */
  const confirmToggle = useCallback(async () => {
    setShowModal(false);
    const newValue = pendingValue;

    // Determine if authentication is needed
    const needsAuth = newValue || requireAuthToDisable;

    if (needsAuth) {
      // Prepare pending flags for return from auth screen
      const pendingKey = pendingEnableKey || `pending${settingKey.charAt(0).toUpperCase() + settingKey.slice(1)}Enable`;

      if (biometricEnabled) {
        try {
          const prompt =
            authPrompt ||
            `Authenticate to ${newValue ? 'enable' : 'disable'} ${settingName}`;

          const result = await authenticateWithBiometrics(prompt, 'Use PIN');

          if (!result.success) {
            // Biometric auth failed, redirect to PIN screen
            await SettingsService.setBoolean(pendingKey, newValue);
            await SettingsService.setBoolean(
              SettingsService.SettingKeys.RETURN_TO_SETTINGS_AFTER_AUTH,
              true
            );
            setIsAuthenticated(false);
            return;
          }

          // Set flag so settings screen knows to scroll back
          await SettingsService.setBoolean(
            SettingsService.SettingKeys.RETURN_TO_SETTINGS_AFTER_AUTH,
            true
          );
        } catch (error: unknown) {
          logger.error('[useAuthenticatedToggle] Biometric auth failed', { error: error instanceof Error ? error.message : String(error), settingName });
          notify.auth.required(`${newValue ? 'enable' : 'disable'} ${settingName}`);
          return;
        }
      } else {
        // No biometrics, redirect to PIN screen
        await SettingsService.setBoolean(pendingKey, newValue);
        await SettingsService.setBoolean(
          SettingsService.SettingKeys.RETURN_TO_SETTINGS_AFTER_AUTH,
          true
        );
        setIsAuthenticated(false);
        return;
      }
    }

    // Authentication successful or not needed, proceed with toggle
    try {
      await SettingsService.setBoolean(settingKey, newValue);

      // Call the value change callback
      if (onValueChange) {
        onValueChange(newValue);
      }

      if (newValue) {
        notify.settings.enabled(settingName);
      } else {
        notify.settings.disabled(settingName);
      }
    } catch (error: unknown) {
      logger.error('[useAuthenticatedToggle] Failed to save setting', { error: error instanceof Error ? error.message : String(error), settingName, settingKey });
      notify.settings.failed(settingName);
    }
  }, [
    pendingValue,
    biometricEnabled,
    setIsAuthenticated,
    settingKey,
    settingName,
    onValueChange,
    requireAuthToDisable,
    pendingEnableKey,
    authPrompt,
  ]);

  /**
   * Cancel toggle - closes modal without changes
   */
  const cancelToggle = useCallback(() => {
    setShowModal(false);
  }, []);

  return useMemo(
    () => ({
      showModal,
      handleToggle,
      confirmToggle,
      cancelToggle,
    }),
    [showModal, handleToggle, confirmToggle, cancelToggle]
  );
}

/**
 * Simpler version for settings that only require auth to enable (not disable)
 */
export function useAuthToEnable(
  settingKey: string,
  settingName: string,
  currentValue: boolean,
  onValueChange: (newValue: boolean) => void,
  authContext: AuthContext
): AuthenticatedToggleReturn {
  return useAuthenticatedToggle({
    settingKey,
    settingName,
    currentValue,
    onValueChange,
    ...authContext,
    requireAuthToDisable: false,
  });
}

/**
 * Version for settings that require auth to both enable AND disable
 */
export function useAuthToToggle(
  settingKey: string,
  settingName: string,
  currentValue: boolean,
  onValueChange: (newValue: boolean) => void,
  authContext: AuthContext
): AuthenticatedToggleReturn {
  return useAuthenticatedToggle({
    settingKey,
    settingName,
    currentValue,
    onValueChange,
    ...authContext,
    requireAuthToDisable: true,
  });
}
