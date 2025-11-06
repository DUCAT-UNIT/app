/**
 * BiometricPromptModal Component
 * Modal prompting user to enable biometric authentication (FaceID/TouchID)
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { SECURE_KEYS } from '../utils/constants';

export default function BiometricPromptModal({
  // State
  visible,
  isAuthenticated,

  // Callbacks
  onClose,
  onBiometricEnabled,
  onBiometricDisabled,
  onShowPinEntry,

  // Styles
  styles,
}) {
  if (!visible) return null;

  const handleEnable = async () => {
    onClose();
    try {
      // Save the preference
      await SecureStore.setItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED, 'true');
      onBiometricEnabled(true);

      // Trigger biometric authentication
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable biometric login',
        fallbackLabel: 'Use PIN instead',
      });
      if (result.success && isAuthenticated !== undefined) {
        // Only set authenticated if this callback is provided
        onBiometricEnabled(true, result.success);
      }
    } catch (error) {
      console.log('Biometric auth error:', error);
    }
  };

  const handleSkip = async () => {
    onClose();
    // Save the preference as disabled
    await SecureStore.setItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED, 'false');
    onBiometricDisabled();

    // If not authenticated yet and callback provided, show PIN entry
    if (!isAuthenticated && onShowPinEntry) {
      onShowPinEntry();
    }
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.biometricPromptModal}>
        <Text style={styles.biometricPromptTitle}>Biometric Authentication</Text>
        <Text style={styles.biometricPromptText}>
          Do you want to use biometric authentication (FaceID or TouchID) for UNIT Wallet?
        </Text>
        <View style={styles.biometricPromptButtons}>
          <TouchableOpacity
            style={[styles.biometricPromptButton, styles.biometricPromptButtonYes]}
            onPress={handleEnable}
          >
            <Text style={styles.biometricPromptButtonText}>Yes, Enable</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.biometricPromptButton, styles.biometricPromptButtonNo]}
            onPress={handleSkip}
          >
            <Text style={styles.biometricPromptButtonTextNo}>No, Thanks</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

BiometricPromptModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  isAuthenticated: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onBiometricEnabled: PropTypes.func.isRequired,
  onBiometricDisabled: PropTypes.func.isRequired,
  onShowPinEntry: PropTypes.func,
  styles: PropTypes.object.isRequired,
};
