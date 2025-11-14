/**
 * PIN Authentication Service
 * Handles PIN hashing, verification, and rate limiting
 */

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
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
 * @param {number} failedAttempts
 * @param {number|null} lockoutUntil
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
    // Fail silently - lockout state is a security feature, not critical for operation
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

    const isValid = storedHashedPin === enteredHashedPin;

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
    return {
      success: false,
      error: 'Failed to verify PIN',
    };
  }
};
