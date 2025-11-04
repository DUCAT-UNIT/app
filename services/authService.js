/**
 * Authentication Service - PIN and Biometric authentication
 */

import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { SECURE_KEYS } from '../utils/constants';

/**
 * Save PIN to secure storage
 * @param {string} pin - 6-digit PIN
 * @returns {Promise<boolean>} Success status
 */
export const savePin = async (pin) => {
  try {
    await SecureStore.setItemAsync(SECURE_KEYS.PIN, pin);
    return true;
  } catch (error) {
    console.error('Failed to save PIN:', error);
    return false;
  }
};

/**
 * Verify entered PIN against stored PIN
 * @param {string} enteredPin - PIN to verify
 * @returns {Promise<boolean>} Whether PIN matches
 */
export const verifyPin = async (enteredPin) => {
  try {
    const storedPin = await SecureStore.getItemAsync(SECURE_KEYS.PIN);
    return storedPin === enteredPin;
  } catch (error) {
    console.error('Failed to verify PIN:', error);
    return false;
  }
};

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
    console.error('Failed to check biometric support:', error);
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
    console.error('Biometric authentication error:', error);
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
    console.error('Failed to check biometric enabled status:', error);
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
    console.error('Failed to set biometric enabled status:', error);
    return false;
  }
};

/**
 * Save mnemonic to secure storage
 * @param {string} mnemonic - BIP39 mnemonic phrase
 * @returns {Promise<boolean>} Success status
 */
export const saveMnemonic = async (mnemonic) => {
  try {
    await SecureStore.setItemAsync(SECURE_KEYS.MNEMONIC, mnemonic);
    return true;
  } catch (error) {
    console.error('Failed to save mnemonic:', error);
    return false;
  }
};

/**
 * Retrieve mnemonic from secure storage
 * @returns {Promise<string|null>} Mnemonic or null if not found
 */
export const getMnemonic = async () => {
  try {
    return await SecureStore.getItemAsync(SECURE_KEYS.MNEMONIC);
  } catch (error) {
    console.error('Failed to retrieve mnemonic:', error);
    return null;
  }
};

/**
 * Delete mnemonic from secure storage
 * @returns {Promise<boolean>} Success status
 */
export const deleteMnemonic = async () => {
  try {
    await SecureStore.deleteItemAsync(SECURE_KEYS.MNEMONIC);
    return true;
  } catch (error) {
    console.error('Failed to delete mnemonic:', error);
    return false;
  }
};

/**
 * Save current account index to secure storage
 * @param {number} accountIndex - Account index
 * @returns {Promise<boolean>} Success status
 */
export const saveCurrentAccount = async (accountIndex) => {
  try {
    await SecureStore.setItemAsync(SECURE_KEYS.CURRENT_ACCOUNT, accountIndex.toString());
    return true;
  } catch (error) {
    console.error('Failed to save current account:', error);
    return false;
  }
};

/**
 * Retrieve current account index from secure storage
 * @returns {Promise<number>} Account index (defaults to 0)
 */
export const getCurrentAccount = async () => {
  try {
    const account = await SecureStore.getItemAsync(SECURE_KEYS.CURRENT_ACCOUNT);
    return account ? parseInt(account, 10) : 0;
  } catch (error) {
    console.error('Failed to retrieve current account:', error);
    return 0;
  }
};

/**
 * Delete all wallet data from secure storage
 * @returns {Promise<boolean>} Success status
 */
export const deleteWalletData = async () => {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(SECURE_KEYS.MNEMONIC),
      SecureStore.deleteItemAsync(SECURE_KEYS.CURRENT_ACCOUNT),
      SecureStore.deleteItemAsync(SECURE_KEYS.PIN),
      SecureStore.deleteItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED),
    ]);
    return true;
  } catch (error) {
    console.error('Failed to delete wallet data:', error);
    return false;
  }
};
