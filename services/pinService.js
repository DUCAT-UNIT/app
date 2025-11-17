/**
 * PIN Authentication Service
 * Handles PIN hashing, verification, and rate limiting
 */

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { pbkdf2Sync } from 'react-native-quick-crypto';

// Manual constant-time comparison since timingSafeEqual isn't available
const timingSafeEqual = (a, b) => {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
};
import { SECURE_KEYS, PIN_HASH_VERSION } from '../utils/constants';
import { PIN, CRYPTO } from '../constants/security';

// Rate limiting for PIN attempts
const MAX_PIN_ATTEMPTS = PIN.MAX_ATTEMPTS;
const LOCKOUT_DURATION = PIN.LOCKOUT_DURATION_MS;

// Secure storage keys for lockout state
const LOCKOUT_KEYS = {
  FAILED_ATTEMPTS: 'pin_failed_attempts',
  LOCKOUT_UNTIL: 'pin_lockout_until',
};

/**
 * Load lockout state from secure storage
 * @returns {Promise<{failedAttempts: number, lockoutUntil: number|null}>}
 */
const loadLockoutState = async () => {
  try {
    const failedAttempts = await SecureStore.getItemAsync(LOCKOUT_KEYS.FAILED_ATTEMPTS);
    const lockoutUntil = await SecureStore.getItemAsync(LOCKOUT_KEYS.LOCKOUT_UNTIL);

    return {
      failedAttempts: failedAttempts ? parseInt(failedAttempts, 10) : 0,
      lockoutUntil: lockoutUntil ? parseInt(lockoutUntil, 10) : null,
    };
  } catch (error) {
    // If we can't load state, return safe defaults
    return {
      failedAttempts: 0,
      lockoutUntil: null,
    };
  }
};

/**
 * Save lockout state to secure storage
 * CRITICAL: This function throws on failure (fail closed for security)
 * If we can't save lockout state, we must deny access to prevent unlimited attempts
 * @param {number} failedAttempts
 * @param {number|null} lockoutUntil
 * @throws {Error} If lockout state cannot be saved (security critical)
 */
const saveLockoutState = async (failedAttempts, lockoutUntil) => {
  try {
    await SecureStore.setItemAsync(LOCKOUT_KEYS.FAILED_ATTEMPTS, failedAttempts.toString());
    if (lockoutUntil) {
      await SecureStore.setItemAsync(LOCKOUT_KEYS.LOCKOUT_UNTIL, lockoutUntil.toString());
    } else {
      await SecureStore.deleteItemAsync(LOCKOUT_KEYS.LOCKOUT_UNTIL);
    }
  } catch (error) {
    // SECURITY: Fail closed - if we can't save lockout state, throw error
    // This prevents attackers from triggering storage failures to bypass rate limiting
    logger.error('CRITICAL: Failed to save lockout state', {
      error: error.message,
      failedAttempts,
      lockoutUntil,
      recommendation: 'Check device storage space and permissions',
    });
    throw new Error('Unable to enforce rate limiting. Access denied for security.');
  }
};

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
 * Hash a PIN using standard PBKDF2 with HMAC-SHA512
 * Uses 10,000 iterations as a balance between security and mobile performance
 * Combined with rate limiting (10 attempts, 30min lockout) this provides strong protection
 * @param {string} pin - PIN to hash
 * @param {string} salt - Unique salt for this user (hex string)
 * @returns {Promise<string>} Hashed PIN (hex string)
 */
const hashPin = async (pin, salt) => {
  try {
    // Use standard PBKDF2 with HMAC-SHA512
    // - password: user's PIN
    // - salt: unique 32-byte salt (hex string converted to buffer)
    // - iterations: 10,000 (configured)
    // - keylen: 64 bytes (512 bits) to match SHA512 output
    // - digest: sha512
    const derivedKey = pbkdf2Sync(
      pin,
      Buffer.from(salt, 'hex'),
      CRYPTO.PIN_HASH_ITERATIONS,
      64, // 64 bytes = 512 bits
      'sha512'
    );
    return derivedKey.toString('hex');
  } catch (error) {
    throw new Error('PIN hashing failed: ' + error.message);
  }
};

/**
 * Export PIN hashing for use in passkey encryption
 * Same security as daily unlock (10,000 iterations)
 * @param {string} pin - PIN to hash
 * @param {string} salt - Unique salt
 * @returns {Promise<string>} Hashed PIN
 */
export const hashPinForEncryption = hashPin;

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

/**
 * Check if PIN attempts are currently locked out
 * @returns {Promise<{isLocked: boolean, remainingTime?: number}>} Lock status
 */
export const checkPinLockout = async () => {
  const { lockoutUntil } = await loadLockoutState();

  if (lockoutUntil && Date.now() < lockoutUntil) {
    const remainingTime = Math.ceil((lockoutUntil - Date.now()) / 1000 / 60); // minutes
    return { isLocked: true, remainingTime };
  }

  // If lockout has expired, clear it
  if (lockoutUntil && Date.now() >= lockoutUntil) {
    await saveLockoutState(0, null);
  }

  return { isLocked: false };
};

/**
 * Reset PIN attempt counter (call after successful authentication)
 */
export const resetPinAttempts = async () => {
  await saveLockoutState(0, null);
};

/**
 * Get remaining PIN attempts before lockout
 * @returns {Promise<number>} Remaining attempts
 */
export const getRemainingPinAttempts = async () => {
  const { failedAttempts } = await loadLockoutState();
  return Math.max(0, MAX_PIN_ATTEMPTS - failedAttempts);
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
    // Convert hex strings to buffers for secure comparison
    let isValid = false;
    try {
      const storedBuffer = Buffer.from(storedHashedPin, 'hex');
      const enteredBuffer = Buffer.from(enteredHashedPin, 'hex');
      // timingSafeEqual requires same length, so check length first (constant time)
      isValid = storedBuffer.length === enteredBuffer.length &&
                storedBuffer.length > 0 &&
                timingSafeEqual(storedBuffer, enteredBuffer);
    } catch (error) {
      // If comparison fails (e.g., invalid hex), treat as invalid PIN
      isValid = false;
    }

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
      // Failed attempt - increment and save
      const newFailedAttempts = failedAttempts + 1;

      // Check if we've hit the limit
      if (newFailedAttempts >= MAX_PIN_ATTEMPTS) {
        const lockoutUntil = Date.now() + LOCKOUT_DURATION;
        await saveLockoutState(newFailedAttempts, lockoutUntil);

        return {
          success: false,
          error: 'Too many failed attempts. Account locked for 30 minutes.',
          remainingAttempts: 0,
        };
      }

      // Save the updated attempt count
      await saveLockoutState(newFailedAttempts, null);

      return {
        success: false,
        error: 'Incorrect PIN',
        remainingAttempts: Math.max(0, MAX_PIN_ATTEMPTS - newFailedAttempts),
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
