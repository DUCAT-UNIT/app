/**
 * useAuthSettings Hook
 * Handles biometric and PIN authentication settings
 */

import { useState, useCallback, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authenticateWithBiometrics } from '../services/biometricService';
import type { ToastType } from '../types/notification';

interface UseAuthSettingsParams {
  biometricEnabled: boolean;
  setBiometricEnabled: (value: boolean) => void;
  setIsAuthenticated: (value: boolean) => void;
  startPinChange: () => void;
  showToast?: (message: string, type: ToastType) => void;
}

interface UseAuthSettingsReturn {
  handleChangePin: () => void;
  handleFaceIdToggle: () => void;
  showFaceIdModal: boolean;
  confirmFaceIdToggle: () => Promise<void>;
  cancelFaceIdToggle: () => void;
}

export function useAuthSettings({ biometricEnabled, setBiometricEnabled, setIsAuthenticated, startPinChange, showToast }: UseAuthSettingsParams): UseAuthSettingsReturn {
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
      } catch (error) {
        if (showToast) {
          showToast('Authentication required to enable Face ID', 'error');
        }
        return;
      }
    }

    // Authentication successful or disabling, proceed with toggle
    setBiometricEnabled(newValue);
    try {
      await SecureStore.setItemAsync('biometricEnabled', String(newValue));
      if (showToast) {
        showToast(`Face ID ${newValue ? 'enabled' : 'disabled'}`, 'success');
      }
    } catch (error) {
      if (showToast) {
        showToast('Failed to update Face ID setting', 'error');
      }
    }
  }, [pendingFaceIdValue, setBiometricEnabled, setIsAuthenticated, showToast]);

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
