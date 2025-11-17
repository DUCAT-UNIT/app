/**
 * PIN Lockout Management
 * Handles rate limiting for PIN attempts to prevent brute force attacks
 */

import * as SecureStore from 'expo-secure-store';
import { PIN } from '../constants/security';
import { logger } from '../utils/logger';

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
export const loadLockoutState = async () => {
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
export const saveLockoutState = async (failedAttempts, lockoutUntil) => {
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
 * Record a failed PIN attempt and check if lockout should be triggered
 * @param {number} currentFailedAttempts - Current number of failed attempts
 * @returns {Promise<{shouldLockout: boolean, newFailedAttempts: number, lockoutUntil?: number}>}
 */
export const recordFailedAttempt = async (currentFailedAttempts) => {
  const newFailedAttempts = currentFailedAttempts + 1;

  // Check if we've hit the limit
  if (newFailedAttempts >= MAX_PIN_ATTEMPTS) {
    const lockoutUntil = Date.now() + LOCKOUT_DURATION;
    await saveLockoutState(newFailedAttempts, lockoutUntil);

    return {
      shouldLockout: true,
      newFailedAttempts,
      lockoutUntil,
    };
  }

  // Save the updated attempt count
  await saveLockoutState(newFailedAttempts, null);

  return {
    shouldLockout: false,
    newFailedAttempts,
  };
};

/**
 * Get max PIN attempts constant
 * @returns {number} Maximum allowed attempts
 */
export const getMaxPinAttempts = () => MAX_PIN_ATTEMPTS;
