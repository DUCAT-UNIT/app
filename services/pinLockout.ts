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
} as const;

export interface LockoutState {
  failedAttempts: number;
  lockoutUntil: number | null;
}

export interface LockoutCheck {
  isLocked: boolean;
  remainingTime?: number;
}

export interface FailedAttemptResult {
  shouldLockout: boolean;
  newFailedAttempts: number;
  lockoutUntil?: number;
}

/**
 * Load lockout state from secure storage
 * @returns Lockout state with failed attempts and lockout timestamp
 */
export const loadLockoutState = async (): Promise<LockoutState> => {
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
 * @param failedAttempts - Number of failed attempts
 * @param lockoutUntil - Timestamp when lockout expires, or null
 * @throws Error if lockout state cannot be saved (security critical)
 */
export const saveLockoutState = async (
  failedAttempts: number,
  lockoutUntil: number | null
): Promise<void> => {
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
      error: (error as Error).message,
      failedAttempts,
      lockoutUntil,
      recommendation: 'Check device storage space and permissions',
    });
    throw new Error('Unable to enforce rate limiting. Access denied for security.');
  }
};

/**
 * Check if PIN attempts are currently locked out
 * @returns Lock status with remaining time if locked
 */
export const checkPinLockout = async (): Promise<LockoutCheck> => {
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
export const resetPinAttempts = async (): Promise<void> => {
  await saveLockoutState(0, null);
};

/**
 * Get remaining PIN attempts before lockout
 * @returns Remaining attempts
 */
export const getRemainingPinAttempts = async (): Promise<number> => {
  const { failedAttempts } = await loadLockoutState();
  return Math.max(0, MAX_PIN_ATTEMPTS - failedAttempts);
};

/**
 * Record a failed PIN attempt and check if lockout should be triggered
 * @param currentFailedAttempts - Current number of failed attempts
 * @returns Result with lockout status and new attempt count
 */
export const recordFailedAttempt = async (
  currentFailedAttempts: number
): Promise<FailedAttemptResult> => {
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
 * @returns Maximum allowed attempts
 */
export const getMaxPinAttempts = (): number => MAX_PIN_ATTEMPTS;
