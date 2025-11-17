/**
 * useAuthenticatedToggle Hook
 * Reusable hook for settings that require authentication to enable
 * Handles modal confirmation, authentication flow, and persistence
 */

import { useState, useCallback, useMemo } from 'react';
import * as AuthService from '../services/authService';
import * as SettingsService from '../services/settingsService';

/**
 * Hook for managing a boolean setting that requires authentication to enable
 * @param {Object} config - Configuration object
 * @param {string} config.settingKey - SecureStore key for the setting
 * @param {string} config.settingName - Display name for the setting
 * @param {boolean} config.currentValue - Current value of the setting
 * @param {Function} config.onValueChange - Callback when value changes (newValue) => void
 * @param {boolean} config.biometricEnabled - Whether biometrics are enabled
 * @param {Function} config.setIsAuthenticated - Function to trigger authentication screen
 * @param {Function} config.showToast - Function to show toast messages
 * @param {string} config.pendingEnableKey - Optional custom key for pending enable flag
 * @param {string} config.authPrompt - Custom authentication prompt message
 * @param {boolean} config.requireAuthToDisable - Require auth to disable (default: false)
 * @returns {Object} Hook API
 */
export function useAuthenticatedToggle(config) {
  const {
    settingKey,
    settingName,
    currentValue,
    onValueChange,
    biometricEnabled,
    setIsAuthenticated,
    showToast,
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

          const result = await AuthService.authenticateWithBiometrics(prompt, 'Use PIN');

          if (!result.success) {
            // Biometric auth failed, redirect to PIN screen
            await SettingsService.setBoolean(pendingKey, String(newValue));
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
        } catch (error) {
          if (showToast) {
            showToast(
              `Authentication required to ${newValue ? 'enable' : 'disable'} ${settingName}`,
              'error'
            );
          }
          return;
        }
      } else {
        // No biometrics, redirect to PIN screen
        await SettingsService.setBoolean(pendingKey, String(newValue));
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

      if (showToast) {
        showToast(`${settingName} ${newValue ? 'enabled' : 'disabled'}`, 'success');
      }
    } catch (error) {
      if (showToast) {
        showToast(`Failed to update ${settingName}`, 'error');
      }
    }
  }, [
    pendingValue,
    biometricEnabled,
    setIsAuthenticated,
    showToast,
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
 * @param {string} settingKey - SecureStore key
 * @param {string} settingName - Display name
 * @param {boolean} currentValue - Current value
 * @param {Function} onValueChange - Callback when value changes
 * @param {Object} authContext - Object with biometricEnabled, setIsAuthenticated, showToast
 * @returns {Object} Hook API
 */
export function useAuthToEnable(settingKey, settingName, currentValue, onValueChange, authContext) {
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
 * @param {string} settingKey - SecureStore key
 * @param {string} settingName - Display name
 * @param {boolean} currentValue - Current value
 * @param {Function} onValueChange - Callback when value changes
 * @param {Object} authContext - Object with biometricEnabled, setIsAuthenticated, showToast
 * @returns {Object} Hook API
 */
export function useAuthToToggle(settingKey, settingName, currentValue, onValueChange, authContext) {
  return useAuthenticatedToggle({
    settingKey,
    settingName,
    currentValue,
    onValueChange,
    ...authContext,
    requireAuthToDisable: true,
  });
}
