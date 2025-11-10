/**
 * Authentication Service - PIN and Biometric authentication
 */

import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import { SECURE_KEYS } from '../utils/constants';

// Salt for PIN hashing - change this to something unique for your app
const PIN_SALT = 'ducat_wallet_pin_salt_v1';

// Rate limiting for PIN attempts
const MAX_PIN_ATTEMPTS = 10;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
let failedPinAttempts = 0;
let pinLockoutUntil = null;

/**
 * Hash a PIN using SHA256
 * @param {string} pin - PIN to hash
 * @returns {Promise<string>} Hashed PIN
 */
const hashPin = async (pin) => {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pin + PIN_SALT
  );
  return hash;
};

/**
 * Save PIN to secure storage (hashed)
 * @param {string} pin - 6-digit PIN
 * @returns {Promise<boolean>} Success status
 */
export const savePin = async (pin) => {
  try {
    const hashedPin = await hashPin(pin);
    await SecureStore.setItemAsync(SECURE_KEYS.PIN, hashedPin);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Check if PIN attempts are currently locked out
 * @returns {{isLocked: boolean, remainingTime?: number}} Lock status
 */
export const checkPinLockout = () => {
  if (pinLockoutUntil && Date.now() < pinLockoutUntil) {
    const remainingTime = Math.ceil((pinLockoutUntil - Date.now()) / 1000 / 60); // minutes
    return { isLocked: true, remainingTime };
  }
  return { isLocked: false };
};

/**
 * Reset PIN attempt counter (call after successful authentication)
 */
export const resetPinAttempts = () => {
  failedPinAttempts = 0;
  pinLockoutUntil = null;
};

/**
 * Get remaining PIN attempts before lockout
 * @returns {number} Remaining attempts
 */
export const getRemainingPinAttempts = () => {
  return Math.max(0, MAX_PIN_ATTEMPTS - failedPinAttempts);
};

/**
 * Verify entered PIN against stored hashed PIN with rate limiting
 * @param {string} enteredPin - PIN to verify
 * @returns {Promise<{success: boolean, error?: string, remainingAttempts?: number}>}
 */
export const verifyPin = async (enteredPin) => {
  try {
    // Check if locked out
    const lockStatus = checkPinLockout();
    if (lockStatus.isLocked) {
      return {
        success: false,
        error: `Too many failed attempts. Try again in ${lockStatus.remainingTime} minutes.`,
        remainingAttempts: 0,
      };
    }

    const storedHashedPin = await SecureStore.getItemAsync(SECURE_KEYS.PIN);
    const enteredHashedPin = await hashPin(enteredPin);
    const isValid = storedHashedPin === enteredHashedPin;

    if (isValid) {
      // Success - reset attempts
      resetPinAttempts();
      return { success: true };
    } else {
      // Failed attempt
      failedPinAttempts++;

      // Check if we've hit the limit
      if (failedPinAttempts >= MAX_PIN_ATTEMPTS) {
        pinLockoutUntil = Date.now() + LOCKOUT_DURATION;
        return {
          success: false,
          error: 'Too many failed attempts. Account locked for 30 minutes.',
          remainingAttempts: 0,
        };
      }

      // Apply exponential backoff delay
      const delayMs = Math.min(Math.pow(2, failedPinAttempts) * 1000, 10000); // Max 10s delay
      await new Promise(resolve => setTimeout(resolve, delayMs));

      return {
        success: false,
        error: 'Incorrect PIN',
        remainingAttempts: getRemainingPinAttempts(),
      };
    }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to verify PIN',
    };
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
    return false;
  }
};

/**
 * Securely clear a string from memory (best effort)
 * Note: JavaScript doesn't guarantee memory overwriting, but we try our best
 * @param {string} str - String to clear
 * @returns {string} Cleared string (filled with zeros)
 */
const securelyWipeString = (str) => {
  if (!str || typeof str !== 'string') return '';

  // Create a new string filled with zeros
  let cleared = '';
  for (let i = 0; i < str.length; i++) {
    cleared += '\0';
  }

  // Overwrite multiple times
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < str.length; i++) {
      cleared = cleared.substring(0, i) +
                String.fromCharCode(Math.floor(Math.random() * 256)) +
                cleared.substring(i + 1);
    }
  }

  return cleared;
};

/**
 * Retrieve mnemonic from secure storage
 * IMPORTANT: Caller must clear the returned mnemonic from memory after use
 * @returns {Promise<string|null>} Mnemonic or null if not found
 */
export const getMnemonic = async () => {
  try {
    return await SecureStore.getItemAsync(SECURE_KEYS.MNEMONIC);
  } catch (error) {
    return null;
  }
};

/**
 * Retrieve mnemonic and automatically clear it after callback execution
 * Use this when you need temporary access to mnemonic
 * @param {Function} callback - Function that receives mnemonic
 * @returns {Promise<any>} Result from callback
 */
export const withMnemonic = async (callback) => {
  let mnemonic = null;
  try {
    mnemonic = await getMnemonic();
    if (!mnemonic) {
      throw new Error('Mnemonic not found');
    }
    return await callback(mnemonic);
  } finally {
    // Best effort to clear from memory
    if (mnemonic) {
      mnemonic = securelyWipeString(mnemonic);
      mnemonic = null;
    }
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
    return false;
  }
};
