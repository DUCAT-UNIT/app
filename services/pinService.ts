/**
 * PIN Authentication Service
 * Handles PIN hashing, verification, and rate limiting
 */

import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS, PIN_HASH_VERSION } from '../utils/constants';
import { logger } from '../utils/logger';
import {
  loadLockoutState,
  checkPinLockout,
  resetPinAttempts,
  getRemainingPinAttempts,
  recordFailedAttempt,
  getMaxPinAttempts,
} from './pinLockout';
import {
  generateSalt,
  hashPin,
  verifyPinHash,
} from './pinHashing';

/**
 * Discriminated union for PIN verification results
 *
 * Uses TypeScript's discriminated union pattern with `success` as the discriminant.
 * This enables exhaustive type checking and automatic type narrowing in conditionals.
 *
 * @example
 * // Basic usage with type narrowing
 * const result = await verifyPin('123456');
 * if (result.success) {
 *   // TypeScript knows this is { success: true }
 *   // No error or remainingAttempts properties exist here
 *   navigateToWallet();
 * } else {
 *   // TypeScript knows this is { success: false; error: string; remainingAttempts: number }
 *   showError(result.error);
 *   updateAttemptsUI(result.remainingAttempts);
 * }
 *
 * @example
 * // Exhaustive handling with switch
 * function handleResult(result: PinVerificationResult) {
 *   switch (result.success) {
 *     case true:
 *       return 'Authenticated!';
 *     case false:
 *       return `Failed: ${result.error} (${result.remainingAttempts} attempts left)`;
 *     // TypeScript error if a case is missing
 *   }
 * }
 *
 * @example
 * // Creating results
 * const successResult: PinVerificationResult = { success: true };
 * const failResult: PinVerificationResult = {
 *   success: false,
 *   error: 'Incorrect PIN',
 *   remainingAttempts: 4
 * };
 */
export type PinVerificationResult =
  | { success: true }
  | { success: false; error: string; remainingAttempts: number };

export interface SavePinResult {
  hashedPin: string;
  salt: string;
}

/**
 * Export PIN hashing for use in passkey encryption
 * Same security as daily unlock (10,000 iterations)
 * @param pin - PIN to hash
 * @param salt - Unique salt
 * @returns Hashed PIN
 */
export const hashPinForEncryption = hashPin;

/**
 * Save PIN and return the hash for passkey encryption (performance optimization)
 * Avoids double-hashing during passkey wallet creation (saves ~500ms)
 * @param pin - 6-digit PIN
 * @returns Hash and salt
 * @throws Error if salt verification fails (security critical)
 */
export const savePinWithHash = async (pin: string): Promise<SavePinResult> => {
  try {
    // Generate a unique salt for this user
    const salt = await generateSalt();
    const hashedPin = await hashPin(pin, salt);

    // Store the hashed PIN, salt, and version
    await SecureStore.setItemAsync(SECURE_KEYS.PIN, hashedPin);
    await SecureStore.setItemAsync(SECURE_KEYS.PIN_SALT, salt);
    await SecureStore.setItemAsync(SECURE_KEYS.PIN_VERSION, PIN_HASH_VERSION.PBKDF2_10K);

    // CRITICAL: Read back the salt to verify it was stored correctly
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

    // Return hash and salt for reuse in passkey encryption
    return { hashedPin, salt };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    // Log detailed error for debugging
    logger.error('PIN save failed:', {
      error: err.message,
      recommendation: 'Check device storage space and SecureStore permissions',
    });

    // Re-throw security-critical errors
    if (err.message.includes('CRITICAL:')) {
      throw error;
    }

    throw new Error('Failed to save PIN');
  }
};

/**
 * Save PIN to secure storage (hashed with unique salt)
 * CRITICAL: Includes read-back verification to ensure salt is stored correctly
 * @param pin - 6-digit PIN
 * @returns Success status
 * @throws Error if salt verification fails (security critical)
 */
export const savePin = async (pin: string): Promise<boolean> => {
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
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    // Log detailed error for debugging
    logger.error('PIN save failed:', {
      error: err.message,
      recommendation: 'Check device storage space and SecureStore permissions',
    });

    // Re-throw security-critical errors
    if (err.message.includes('CRITICAL:')) {
      throw error;
    }

    return false;
  }
};

/**
 * Save PIN using an existing salt (for wallet recovery)
 * CRITICAL: Includes read-back verification to ensure PIN is stored correctly
 * @param pin - 6-digit PIN
 * @param existingSalt - Existing salt (from backup)
 * @returns Success status
 * @throws Error if PIN verification fails (security critical)
 */
export const savePinWithExistingSalt = async (pin: string, existingSalt: string): Promise<boolean> => {
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
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    // Log detailed error for debugging
    logger.error('PIN save with existing salt failed:', {
      error: err.message,
      recommendation: 'Check device storage space and SecureStore permissions',
    });

    // Re-throw security-critical errors
    if (err.message.includes('CRITICAL:')) {
      throw error;
    }

    return false;
  }
};

// Re-export lockout management functions
export { checkPinLockout, resetPinAttempts, getRemainingPinAttempts };

/**
 * Verify entered PIN against stored hashed PIN with rate limiting
 * @param enteredPin - PIN to verify
 * @returns Verification result with success status and optional error
 */
export const verifyPin = async (enteredPin: string): Promise<PinVerificationResult> => {
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

    // Retrieve the stored salt and hashed PIN
    const storedHashedPin = await SecureStore.getItemAsync(SECURE_KEYS.PIN);
    const storedSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);

    // If salt doesn't exist, this is a corrupted state
    if (!storedSalt) {
      return {
        success: false,
        error: 'PIN needs to be reset',
        remainingAttempts: 0,
      };
    }

    // Hash entered PIN with PBKDF2
    const enteredHashedPin = await hashPin(enteredPin, storedSalt);

    // Verify PIN is stored - if not, this is a corrupted state
    if (!storedHashedPin) {
      return {
        success: false,
        error: 'PIN not configured',
        remainingAttempts: 0,
      };
    }

    // Use constant-time comparison to prevent timing attacks
    const isValid = verifyPinHash(storedHashedPin, enteredHashedPin);

    if (isValid) {
      // Success - reset attempts
      await resetPinAttempts();
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
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    // Check if this is a lockout state save failure (fail closed scenario)
    if (err.message && err.message.includes('Unable to enforce rate limiting')) {
      return {
        success: false,
        error: err.message, // Pass through the specific error message
        remainingAttempts: 0,
      };
    }

    // Generic PIN verification failure
    return {
      success: false,
      error: 'Failed to verify PIN',
      remainingAttempts: 0,
    };
  }
};
