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
