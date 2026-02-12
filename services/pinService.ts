/**
 * PIN Authentication Service
 * Handles PIN hashing, verification, and rate limiting
 */

import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS, PIN_HASH_VERSION } from '../utils/constants';
import { CRYPTO } from '../constants/security';
import { logger } from '../utils/logger';
import {
  loadLockoutState,
  checkPinLockout,
  resetPinAttempts,
  getRemainingPinAttempts,
  recordFailedAttempt,
  getMaxPinAttempts,
} from './pinLockout';
import { resetBiometricAttempts } from './biometricService';
import {
  generateSalt,
  hashPin,
  verifyPinHash,
  generateSaltHmac,
  verifySaltHmac,
} from './pinHashing';
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';

const getOrCreateHmacKey = async (): Promise<string> => {
  let key = await SecureStore.getItemAsync(SECURE_KEYS.PIN_HMAC_KEY);
  if (!key) {
    const bytes = await Crypto.getRandomBytesAsync(32);
    key = Buffer.from(bytes).toString('hex');
    await SecureStore.setItemAsync(SECURE_KEYS.PIN_HMAC_KEY, key);
  }
  return key;
};

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
    const hmacKey = await getOrCreateHmacKey();

    // Generate HMAC for salt integrity verification using device-bound random key
    const saltHmac = generateSaltHmac(salt, hmacKey);

    // Store the hashed PIN, salt, HMAC, and version (using new 310K iteration standard)
    await SecureStore.setItemAsync(SECURE_KEYS.PIN, hashedPin);
    await SecureStore.setItemAsync(SECURE_KEYS.PIN_SALT, salt);
    await SecureStore.setItemAsync(SECURE_KEYS.PIN_SALT_HMAC, saltHmac);
    await SecureStore.setItemAsync(SECURE_KEYS.PIN_VERSION, PIN_HASH_VERSION.PBKDF2_310K);

    // CRITICAL: Read back all values to verify they were stored correctly
    const verifiedSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
    const verifiedPin = await SecureStore.getItemAsync(SECURE_KEYS.PIN);
    const verifiedHmac = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT_HMAC);
    const verifiedHmacKey = await SecureStore.getItemAsync(SECURE_KEYS.PIN_HMAC_KEY);
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

    if (verifiedVersion !== PIN_HASH_VERSION.PBKDF2_310K) {
      throw new Error(
        'CRITICAL: PIN version verification failed. ' +
        'Expected version does not match stored version. ' +
        'This would prevent wallet access.'
      );
    }

    if (verifiedHmac !== saltHmac) {
      throw new Error(
        'CRITICAL: Salt HMAC verification failed. ' +
        'Expected HMAC does not match stored HMAC. ' +
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
    const hmacKey = await getOrCreateHmacKey();

    // Generate HMAC for salt integrity verification
    const saltHmac = generateSaltHmac(salt, hmacKey);

    // Store the hashed PIN, salt, HMAC, and version (using new 310K iteration standard)
    await SecureStore.setItemAsync(SECURE_KEYS.PIN, hashedPin);
    await SecureStore.setItemAsync(SECURE_KEYS.PIN_SALT, salt);
    await SecureStore.setItemAsync(SECURE_KEYS.PIN_SALT_HMAC, saltHmac);
    await SecureStore.setItemAsync(SECURE_KEYS.PIN_VERSION, PIN_HASH_VERSION.PBKDF2_310K);

    // CRITICAL: Read back all values to verify they were stored correctly
    // If salt is corrupted, the user will never be able to unlock their wallet
    const verifiedSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
    const verifiedPin = await SecureStore.getItemAsync(SECURE_KEYS.PIN);
    const verifiedHmac = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT_HMAC);
    const verifiedHmacKey = await SecureStore.getItemAsync(SECURE_KEYS.PIN_HMAC_KEY);
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

    if (verifiedVersion !== PIN_HASH_VERSION.PBKDF2_310K) {
      throw new Error(
        'CRITICAL: PIN version verification failed. ' +
        'Expected version does not match stored version. ' +
        'This would prevent wallet access.'
      );
    }

    if (verifiedHmac !== saltHmac) {
      throw new Error(
        'CRITICAL: Salt HMAC verification failed. ' +
        'Expected HMAC does not match stored HMAC. ' +
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

    // Generate HMAC for salt integrity verification (salt already exists)
    const hmacKey = await getOrCreateHmacKey();
    const saltHmac = generateSaltHmac(existingSalt, hmacKey);

    // Store the hashed PIN, HMAC, and version (salt already exists, using new 310K iteration standard)
    await SecureStore.setItemAsync(SECURE_KEYS.PIN, hashedPin);
    await SecureStore.setItemAsync(SECURE_KEYS.PIN_SALT_HMAC, saltHmac);
    await SecureStore.setItemAsync(SECURE_KEYS.PIN_VERSION, PIN_HASH_VERSION.PBKDF2_310K);

    // CRITICAL: Read back all values to verify they were stored correctly
    const verifiedPin = await SecureStore.getItemAsync(SECURE_KEYS.PIN);
    const verifiedHmac = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT_HMAC);
    const verifiedVersion = await SecureStore.getItemAsync(SECURE_KEYS.PIN_VERSION);

    // Verify all critical values were stored correctly
    if (verifiedPin !== hashedPin) {
      throw new Error(
        'CRITICAL: PIN hash verification failed. ' +
        'Expected hash does not match stored hash. ' +
        'This would prevent wallet access.'
      );
    }

    if (verifiedVersion !== PIN_HASH_VERSION.PBKDF2_310K) {
      throw new Error(
        'CRITICAL: PIN version verification failed. ' +
        'Expected version does not match stored version. ' +
        'This would prevent wallet access.'
      );
    }

    if (verifiedHmac !== saltHmac) {
      throw new Error(
        'CRITICAL: Salt HMAC verification failed. ' +
        'Expected HMAC does not match stored HMAC. ' +
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
 * Includes automatic migration from legacy 10K iterations to 310K iterations
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

    // Retrieve the stored salt, hashed PIN, HMAC, and version
    const storedHashedPin = await SecureStore.getItemAsync(SECURE_KEYS.PIN);
    const storedSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
    const storedHmac = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT_HMAC);
    let hmacKey = await SecureStore.getItemAsync(SECURE_KEYS.PIN_HMAC_KEY);
    const storedVersion = await SecureStore.getItemAsync(SECURE_KEYS.PIN_VERSION);

    // If salt doesn't exist, this is a corrupted state
    if (!storedSalt) {
      return {
        success: false,
        error: 'PIN authentication unavailable. Please restore wallet from seed phrase.',
        remainingAttempts: 0,
      };
    }

    // Verify PIN is stored - if not, this is a corrupted state
    if (!storedHashedPin) {
      return {
        success: false,
        error: 'PIN not configured. Please set up authentication.',
        remainingAttempts: 0,
      };
    }

    // Verify salt integrity using HMAC (if HMAC exists)
    // HMAC may not exist for legacy installations - that's OK, we'll create it on next save
    if (!hmacKey) {
      // Generate and persist a new HMAC key if missing (legacy installs)
      hmacKey = Buffer.from(await Crypto.getRandomBytesAsync(32)).toString('hex');
      await SecureStore.setItemAsync(SECURE_KEYS.PIN_HMAC_KEY, hmacKey);
    }

    if (storedHmac) {
      const isIntegrityValid = verifySaltHmac(storedSalt, storedHmac, hmacKey);
      if (!isIntegrityValid) {
        logger.error('Salt integrity check failed - possible corruption detected');
        return {
          success: false,
          error: 'PIN data corrupted. Please restore wallet from seed phrase.',
          remainingAttempts: 0,
        };
      }
    }

    // Determine iteration count based on version (migration support)
    // Default to legacy 10K for backwards compatibility if no version stored
    const isLegacyVersion = !storedVersion || storedVersion === PIN_HASH_VERSION.PBKDF2_10K;
    const iterations = isLegacyVersion ? CRYPTO.LEGACY_PIN_HASH_ITERATIONS : CRYPTO.PIN_HASH_ITERATIONS;

    // Hash entered PIN with appropriate iteration count
    const enteredHashedPin = await hashPin(enteredPin, storedSalt, iterations);

    // Use constant-time comparison to prevent timing attacks
    const isValid = verifyPinHash(storedHashedPin, enteredHashedPin);

    if (isValid) {
      // Success - reset both PIN and biometric attempts (unified lockout)
      await resetPinAttempts();
      await resetBiometricAttempts();

      // AUTOMATIC MIGRATION: If user is on legacy version or missing HMAC, migrate to new version
      const needsMigration = isLegacyVersion || !storedHmac;
      if (needsMigration) {
        try {
          if (isLegacyVersion) {
            logger.security('Migrating PIN from legacy 10K to 310K iterations');
          } else {
            logger.security('Adding salt HMAC to existing PIN');
          }

          // Re-hash with new iteration count (same salt) - or use existing hash if only adding HMAC
          const newHashedPin = isLegacyVersion ? await hashPin(enteredPin, storedSalt) : storedHashedPin;

          // Generate HMAC for salt integrity
          const saltHmac = generateSaltHmac(storedSalt, hmacKey);

          // Update stored hash, HMAC, and version
          await SecureStore.setItemAsync(SECURE_KEYS.PIN, newHashedPin);
          await SecureStore.setItemAsync(SECURE_KEYS.PIN_SALT_HMAC, saltHmac);
          await SecureStore.setItemAsync(SECURE_KEYS.PIN_VERSION, PIN_HASH_VERSION.PBKDF2_310K);

          // Verify migration succeeded
          const verifiedPin = await SecureStore.getItemAsync(SECURE_KEYS.PIN);
          const verifiedHmac = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT_HMAC);
          const verifiedVersion = await SecureStore.getItemAsync(SECURE_KEYS.PIN_VERSION);

          if (verifiedPin === newHashedPin &&
              verifiedHmac === saltHmac &&
              verifiedVersion === PIN_HASH_VERSION.PBKDF2_310K) {
            logger.security('PIN migration successful - now using 310K iterations with HMAC integrity');
          } else {
            // Migration failed but user is still authenticated with legacy hash
            logger.error('PIN migration verification failed - user still on legacy hash');
          }
        } catch (migrationError) {
          // Log but don't fail authentication - user successfully authenticated with legacy hash
          logger.error('PIN migration failed:', { error: (migrationError as Error).message });
        }
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

      const remainingAttempts = Math.max(0, getMaxPinAttempts() - result.newFailedAttempts);
      return {
        success: false,
        error: `Incorrect PIN. ${remainingAttempts} ${remainingAttempts === 1 ? 'attempt' : 'attempts'} remaining.`,
        remainingAttempts,
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
