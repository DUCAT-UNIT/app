/**
 * useAuthSettings Hook
 * Handles biometric and PIN authentication settings
 */

import { useState, useCallback, useMemo } from 'react';
import {
  authenticateWithBiometrics,
  setBiometricEnabled as persistBiometricEnabled,
} from '../services/biometricService';
import { SettingKeys, setBoolean } from '../services/settingsService';
import { notify } from '../utils/notify';
import { logger } from '../utils/logger';

interface UseAuthSettingsParams {
  biometricEnabled: boolean;
  setBiometricEnabled: (value: boolean) => void;
  setIsAuthenticated: (value: boolean) => void;
  startPinChange: () => void;
}

interface UseAuthSettingsReturn {
  handleChangePin: () => void;
  handleFaceIdToggle: () => void;
  showFaceIdModal: boolean;
  confirmFaceIdToggle: () => Promise<void>;
  cancelFaceIdToggle: () => void;
}

export function useAuthSettings({ biometricEnabled, setBiometricEnabled, setIsAuthenticated, startPinChange }: UseAuthSettingsParams): UseAuthSettingsReturn {
  const [showFaceIdModal, setShowFaceIdModal] = useState(false);
  const [pendingFaceIdValue, setPendingFaceIdValue] = useState(false);

  const persistBooleanOrThrow = useCallback(async (key: string, value: boolean, failureMessage: string) => {
    if (!await setBoolean(key, value)) {
      throw new Error(failureMessage);
    }
  }, []);

  const handleChangePin = useCallback((): void => {
    startPinChange();
  }, [startPinChange]);

  const handleFaceIdToggle = useCallback((): void => {
    const newValue = !biometricEnabled;
    setPendingFaceIdValue(newValue);
    setShowFaceIdModal(true);
  }, [biometricEnabled]);

  const confirmFaceIdToggle = useCallback(async (): Promise<void> => {
    setShowFaceIdModal(false);
    const newValue = pendingFaceIdValue;

    // If enabling, require authentication first
    if (newValue) {
      try {
        const result = await authenticateWithBiometrics(
          'Authenticate to enable Face ID',
          'Use PIN'
        );

        if (!result.success) {
          // Biometric failed, fall back to PIN
          await persistBooleanOrThrow(
            SettingKeys.PENDING_FACE_ID_ENABLE,
            true,
            'Failed to persist pending Face ID flag'
          );
          await persistBooleanOrThrow(
            SettingKeys.RETURN_TO_SETTINGS_AFTER_AUTH,
            true,
            'Failed to persist return-to-settings flag'
          );
          setIsAuthenticated(false);
          return;
        }

        // Biometric auth succeeded, set flag to return to settings
        await persistBooleanOrThrow(
          SettingKeys.RETURN_TO_SETTINGS_AFTER_AUTH,
          true,
          'Failed to persist return-to-settings flag'
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('[useAuthSettings] Biometric auth failed for Face ID toggle', { error: message });
        if (message.includes('persist')) {
          notify.settings.faceIdFailed();
        } else {
          notify.auth.requiredForFaceId();
        }
        return;
      }
    }

    // Authentication successful or disabling, proceed with toggle
    setBiometricEnabled(newValue);
    try {
      if (!await persistBiometricEnabled(newValue)) {
        throw new Error('Failed to persist biometric preference');
      }
      if (newValue) {
        notify.settings.faceIdEnabled();
      } else {
        notify.settings.faceIdDisabled();
      }
    } catch (error: unknown) {
      setBiometricEnabled(!newValue);
      logger.error('[useAuthSettings] Failed to save biometric setting', { error: error instanceof Error ? error.message : String(error) });
      notify.settings.faceIdFailed();
    }
  }, [pendingFaceIdValue, persistBooleanOrThrow, setBiometricEnabled, setIsAuthenticated]);

  const cancelFaceIdToggle = useCallback((): void => {
    setShowFaceIdModal(false);
  }, []);

  return useMemo(
    () => ({
      handleChangePin,
      handleFaceIdToggle,
      showFaceIdModal,
      confirmFaceIdToggle,
      cancelFaceIdToggle,
    }),
    [handleChangePin, handleFaceIdToggle, showFaceIdModal, confirmFaceIdToggle, cancelFaceIdToggle]
  );
}
