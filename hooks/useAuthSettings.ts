/**
 * useAuthSettings Hook
 * Handles biometric and PIN authentication settings
 */

import { useState, useCallback, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authenticateWithBiometrics } from '../services/biometricService';
import { notify } from '../utils/notify';

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
          await SecureStore.setItemAsync('pendingFaceIdEnable', 'true');
          await SecureStore.setItemAsync('returnToSettingsAfterAuth', 'true');
          setIsAuthenticated(false);
          return;
        }

        // Biometric auth succeeded, set flag to return to settings
        await SecureStore.setItemAsync('returnToSettingsAfterAuth', 'true');
      } catch {
        notify.auth.requiredForFaceId();
        return;
      }
    }

    // Authentication successful or disabling, proceed with toggle
    setBiometricEnabled(newValue);
    try {
      await SecureStore.setItemAsync('biometricEnabled', String(newValue));
      if (newValue) {
        notify.settings.faceIdEnabled();
      } else {
        notify.settings.faceIdDisabled();
      }
    } catch {
      notify.settings.faceIdFailed();
    }
  }, [pendingFaceIdValue, setBiometricEnabled, setIsAuthenticated]);

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
