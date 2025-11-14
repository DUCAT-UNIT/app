/**
 * useAuthSettings Hook
 * Handles biometric and PIN authentication settings
 */

import { useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as AuthService from '../services/authService';

export function useAuthSettings({ biometricEnabled, setBiometricEnabled, setIsAuthenticated, startPinChange, showToast }) {
  const [showFaceIdModal, setShowFaceIdModal] = useState(false);
  const [pendingFaceIdValue, setPendingFaceIdValue] = useState(false);

  const handleChangePin = () => {
    startPinChange();
  };

  const handleFaceIdToggle = () => {
    const newValue = !biometricEnabled;
    setPendingFaceIdValue(newValue);
    setShowFaceIdModal(true);
  };

  const confirmFaceIdToggle = async () => {
    setShowFaceIdModal(false);
    const newValue = pendingFaceIdValue;

    // If enabling, require authentication first
    if (newValue) {
      try {
        const result = await AuthService.authenticateWithBiometrics(
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
  };

  const cancelFaceIdToggle = () => {
    setShowFaceIdModal(false);
  };

  return {
    handleChangePin,
    handleFaceIdToggle,
    showFaceIdModal,
    confirmFaceIdToggle,
    cancelFaceIdToggle,
  };
}
