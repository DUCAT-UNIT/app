/**
 * Biometric Authentication Service
 * Handles Face ID, Touch ID, and other biometric authentication
 */

import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { SECURE_KEYS } from '../utils/constants';

/**
 * Check if device supports biometric authentication
 * @returns {Promise<boolean>} Whether biometrics are supported
 */
export const checkBiometricSupport = async () => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  } catch (error) {
    return false;
  }
};

/**
 * Authenticate user with biometrics
 * @param {string} promptMessage - Message to display in auth prompt
 * @param {string} fallbackLabel - Label for fallback option
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const authenticateWithBiometrics = async (
  promptMessage = 'Authenticate to access your wallet',
  fallbackLabel = 'Use PIN'
) => {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel,
      disableDeviceFallback: false,
    });

    return {
      success: result.success,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Check if user has enabled biometric authentication
 * @returns {Promise<boolean>} Whether biometrics are enabled
 */
export const isBiometricEnabled = async () => {
  try {
    const enabled = await SecureStore.getItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED);
    return enabled === 'true';
  } catch (error) {
    return false;
  }
};

/**
 * Enable or disable biometric authentication
 * @param {boolean} enabled - Whether to enable biometrics
 * @returns {Promise<boolean>} Success status
 */
export const setBiometricEnabled = async (enabled) => {
  try {
    await SecureStore.setItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED, enabled ? 'true' : 'false');
    return true;
  } catch (error) {
    return false;
  }
};
