/**
 * PIN Authentication Service
 * Handles PIN hashing, verification, and rate limiting
 */

import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS, PIN_HASH_VERSION } from '../utils/constants';
import { logger } from '../utils/logger';
import {
  loadLockoutState,
  saveLockoutState,
  checkPinLockout,
  resetPinAttempts,
  getRemainingPinAttempts,
  recordFailedAttempt,
  getMaxPinAttempts,
} from './pinLockout';
import {
  generateSalt,
  hashPin,
  hashPinLegacy,
  verifyPinHash,
} from './pinHashing';

/**
 * Export PIN hashing for use in passkey encryption
 * Same security as daily unlock (10,000 iterations)
 * @param {string} pin - PIN to hash
 * @param {string} salt - Unique salt
 * @returns {Promise<string>} Hashed PIN
 */
export const hashPinForEncryption = hashPin;

/**
 * Save PIN to secure storage (hashed with unique salt)
 * CRITICAL: Includes read-back verification to ensure salt is stored correctly
 * @param {string} pin - 6-digit PIN
 * @returns {Promise<boolean>} Success status
 * @throws {Error} If salt verification fails (security critical)
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

    // CRITICAL: Read back the salt to verify it was stored correctly
    // If salt is corrupted, the user will never be able to unlock their wallet
    const verifiedSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
    const verifiedPin = await SecureStore.getItemAsync(SECURE_KEYS.PIN);
    const verifiedVersion = await SecureStore.getItemAsync(SECURE_KEYS.PIN_VERSION);

    // Verify all critical values were stored correctly
    if (verifiedSalt !== salt) {
      throw new Error(
        'CRITICAL: PIN salt verification failed. ' +
        'Expected salt does not match stored salt. ' +
        'This would prevent wallet access.'
      );
    }

    if (verifiedPin !== hashedPin) {
      throw new Error(
        'CRITICAL: PIN hash verification failed. ' +
        'Expected hash does not match stored hash. ' +
        'This would prevent wallet access.'
      );
    }

    if (verifiedVersion !== PIN_HASH_VERSION.PBKDF2_10K) {
      throw new Error(
        'CRITICAL: PIN version verification failed. ' +
        'Expected version does not match stored version. ' +
        'This would prevent wallet access.'
      );
    }

    return true;
  } catch (error) {
    // Log detailed error for debugging
    logger.error('PIN save failed:', {
      error: error.message,
      recommendation: 'Check device storage space and SecureStore permissions',
    });

    // Re-throw security-critical errors
    if (error.message.includes('CRITICAL:')) {
      throw error;
    }

    return false;
  }
};

/**
 * Save PIN using an existing salt (for wallet recovery)
 * CRITICAL: Includes read-back verification to ensure PIN is stored correctly
 * @param {string} pin - 6-digit PIN
 * @param {string} existingSalt - Existing salt (from backup)
 * @returns {Promise<boolean>} Success status
 * @throws {Error} If PIN verification fails (security critical)
 */
export const savePinWithExistingSalt = async (pin, existingSalt) => {
  try {
    const hashedPin = await hashPin(pin, existingSalt);

    // Store the hashed PIN and version (salt already exists)
    await SecureStore.setItemAsync(SECURE_KEYS.PIN, hashedPin);
    await SecureStore.setItemAsync(SECURE_KEYS.PIN_VERSION, PIN_HASH_VERSION.PBKDF2_10K);

    // CRITICAL: Read back the PIN hash to verify it was stored correctly
    const verifiedPin = await SecureStore.getItemAsync(SECURE_KEYS.PIN);
    const verifiedVersion = await SecureStore.getItemAsync(SECURE_KEYS.PIN_VERSION);

    // Verify all critical values were stored correctly
    if (verifiedPin !== hashedPin) {
      throw new Error(
        'CRITICAL: PIN hash verification failed. ' +
        'Expected hash does not match stored hash. ' +
        'This would prevent wallet access.'
      );
    }

    if (verifiedVersion !== PIN_HASH_VERSION.PBKDF2_10K) {
      throw new Error(
        'CRITICAL: PIN version verification failed. ' +
        'Expected version does not match stored version. ' +
        'This would prevent wallet access.'
      );
    }

    return true;
  } catch (error) {
    // Log detailed error for debugging
    logger.error('PIN save with existing salt failed:', {
      error: error.message,
      recommendation: 'Check device storage space and SecureStore permissions',
    });

    // Re-throw security-critical errors
    if (error.message.includes('CRITICAL:')) {
      throw error;
    }

    return false;
  }
};

// Re-export lockout management functions
export { checkPinLockout, resetPinAttempts, getRemainingPinAttempts };

/**
 * Verify entered PIN against stored hashed PIN with rate limiting
 * Supports migration from legacy SHA256 to new PBKDF2-like hashing
 * @param {string} enteredPin - PIN to verify
 * @returns {Promise<{success: boolean, error?: string, remainingAttempts?: number, needsMigration?: boolean}>}
 */
export const verifyPin = async (enteredPin) => {
  try {
    // Check if locked out
    const lockStatus = await checkPinLockout();
    if (lockStatus.isLocked) {
      return {
        success: false,
        error: `Too many failed attempts. Try again in ${lockStatus.remainingTime} minutes.`,
        remainingAttempts: 0,
      };
    }

    // Load current lockout state
    const { failedAttempts } = await loadLockoutState();

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

    // Use constant-time comparison to prevent timing attacks
    const isValid = verifyPinHash(storedHashedPin, enteredHashedPin);

    if (isValid) {
      // Success - reset attempts
      await resetPinAttempts();

      // If using legacy hash, trigger migration on next PIN change
      if (isLegacy) {
        return {
          success: true,
          needsMigration: true, // Signal that PIN should be migrated
        };
      }

      return { success: true };
    } else {
      // Failed attempt - record it and check for lockout
      const result = await recordFailedAttempt(failedAttempts);

      if (result.shouldLockout) {
        return {
          success: false,
          error: 'Too many failed attempts. Account locked for 30 minutes.',
          remainingAttempts: 0,
        };
      }

      return {
        success: false,
        error: 'Incorrect PIN',
        remainingAttempts: Math.max(0, getMaxPinAttempts() - result.newFailedAttempts),
      };
    }
  } catch (error) {
    // Check if this is a lockout state save failure (fail closed scenario)
    if (error.message && error.message.includes('Unable to enforce rate limiting')) {
      return {
        success: false,
        error: error.message, // Pass through the specific error message
      };
    }

    // Generic PIN verification failure
    return {
      success: false,
      error: 'Failed to verify PIN',
    };
  }
};
