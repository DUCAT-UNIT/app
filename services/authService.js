/**
 * Authentication Service - PIN and Biometric authentication
 */

import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import { SECURE_KEYS, PIN_HASH_VERSION } from '../utils/constants';
import { PIN, CRYPTO } from '../constants/security';

// Rate limiting for PIN attempts
const MAX_PIN_ATTEMPTS = PIN.MAX_ATTEMPTS;
const LOCKOUT_DURATION = PIN.LOCKOUT_DURATION_MS;
let failedPinAttempts = 0;
let pinLockoutUntil = null;

/**
 * Generate a cryptographically secure random salt
 * @returns {Promise<string>} Random salt in hex format
 */
const generateSalt = async () => {
  const randomBytes = await Crypto.getRandomBytesAsync(CRYPTO.SALT_LENGTH_BYTES);
  return Array.from(randomBytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Hash a PIN using PBKDF2-like approach with a unique salt
 * Uses 10,000 iterations as a balance between security and mobile performance
 * Combined with rate limiting (10 attempts, 30min lockout) this provides strong protection
 * @param {string} pin - PIN to hash
 * @param {string} salt - Unique salt for this user
 * @returns {Promise<string>} Hashed PIN
 */
const hashPin = async (pin, salt) => {
  // Use configured iteration count for PBKDF2-like hashing
  const iterations = CRYPTO.PIN_HASH_ITERATIONS;

  // Initial hash with SHA512 (stronger than SHA256)
  let derivedKey = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA512, pin + salt);

  // Apply iterative hashing (PBKDF2-like approach)
  // This makes brute-force attacks ~10,000x more expensive
  for (let i = 1; i < iterations; i++) {
    derivedKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA512,
      derivedKey + salt
    );
  }

  return derivedKey;
};

/**
 * Save PIN to secure storage (hashed with unique salt)
 * @param {string} pin - 6-digit PIN
 * @returns {Promise<boolean>} Success status
 */
export const savePin = async (pin) => {
  try {
    // Generate a unique salt for this user
    const salt = await generateSalt();
    const hashedPin = await hashPin(pin, salt);

    // Store the hashed PIN, salt, and version
    await SecureStore.setItemAsync(SECURE_KEYS.PIN, hashedPin);
    await SecureStore.setItemAsync(SECURE_KEYS.PIN_SALT, salt);
    await SecureStore.setItemAsync(SECURE_KEYS.PIN_VERSION, PIN_HASH_VERSION.PBKDF2_10K);

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
 * Hash PIN using legacy SHA256 method (for migration support)
 * @param {string} pin - PIN to hash
 * @param {string} salt - Salt
 * @returns {Promise<string>} Hashed PIN
 */
const hashPinLegacy = async (pin, salt) => {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin + salt);
};

/**
 * Verify entered PIN against stored hashed PIN with rate limiting
 * Supports migration from legacy SHA256 to new PBKDF2-like hashing
 * @param {string} enteredPin - PIN to verify
 * @returns {Promise<{success: boolean, error?: string, remainingAttempts?: number, needsMigration?: boolean}>}
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

    // Retrieve the stored salt, hashed PIN, and version
    const storedHashedPin = await SecureStore.getItemAsync(SECURE_KEYS.PIN);
    const storedSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
    const pinVersion = await SecureStore.getItemAsync(SECURE_KEYS.PIN_VERSION);

    // If salt doesn't exist, this is a corrupted state
    if (!storedSalt) {
      return {
        success: false,
        error: 'PIN needs to be reset for security upgrade',
      };
    }

    // Determine which hashing method to use
    const isLegacy = !pinVersion || pinVersion === PIN_HASH_VERSION.SHA256_LEGACY;
    let enteredHashedPin;

    if (isLegacy) {
      // Use legacy SHA256 for verification
      enteredHashedPin = await hashPinLegacy(enteredPin, storedSalt);
    } else {
      // Use new PBKDF2-like hashing
      enteredHashedPin = await hashPin(enteredPin, storedSalt);
    }

    const isValid = storedHashedPin === enteredHashedPin;

    if (isValid) {
      // Success - reset attempts
      resetPinAttempts();

      // If using legacy hash, trigger migration on next PIN change
      if (isLegacy) {
        return {
          success: true,
          needsMigration: true, // Signal that PIN should be migrated
        };
      }

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
      const delayMs = Math.min(Math.pow(2, failedPinAttempts) * 1000, PIN.MAX_BACKOFF_DELAY_MS);
      await new Promise((resolve) => setTimeout(resolve, delayMs));

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
      cleared =
        cleared.substring(0, i) +
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
      SecureStore.deleteItemAsync(SECURE_KEYS.PIN_SALT),
      SecureStore.deleteItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED),
    ]);
    return true;
  } catch (error) {
    return false;
  }
};
