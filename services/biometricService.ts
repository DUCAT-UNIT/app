/**
 * Biometric Authentication Service
 * Handles Face ID, Touch ID, and other biometric authentication
 */

import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform, PlatformIOSStatic } from 'react-native';
import { SECURE_KEYS } from '../utils/constants';
import { logger } from '../utils/logger';
import { withTimeout } from '../utils/withTimeout';
import { resetPinAttempts, loadLockoutState, recordFailedAttempt } from './pinLockout';
import {
  DEVICE_ONLY,
  deletePreferenceItem,
  getPreferenceItem,
  setDeviceOnlyItem,
} from './storagePolicy';

// Timeout for biometric authentication to prevent indefinite hangs
// (iPad compatibility mode can cause the native dialog to stall)
const BIOMETRIC_AUTH_TIMEOUT_MS = 15000;

// Rate limiting constants
const BIOMETRIC_KEYS = {
  FAILED_ATTEMPTS: 'biometric_failed_attempts_v1',
  LOCKOUT_UNTIL: 'biometric_lockout_until_v1',
} as const;

const BIOMETRIC_MAX_ATTEMPTS = 5;
const BIOMETRIC_LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes (matches PIN lockout)

export interface BiometricResult {
  success: boolean;
  error?: string;
}

/**
 * Check if biometric authentication is locked out
 * Throws error if locked out
 */
export const checkBiometricLockout = async (): Promise<void> => {
  const lockoutUntil = await SecureStore.getItemAsync(BIOMETRIC_KEYS.LOCKOUT_UNTIL);

  if (lockoutUntil) {
    const lockoutTime = parseInt(lockoutUntil, 10);
    const now = Date.now();

    if (now < lockoutTime) {
      const remainingMs = lockoutTime - now;
      const remainingMin = Math.ceil(remainingMs / 60000);

      logger.warn('Biometric authentication locked out', { remainingMin });
      throw new Error(
        `Too many failed biometric attempts. ` +
          `Please try again in ${remainingMin} minute${remainingMin > 1 ? 's' : ''} or use your PIN.`
      );
    } else {
      // Lockout expired - clear it
      await SecureStore.deleteItemAsync(BIOMETRIC_KEYS.LOCKOUT_UNTIL);
      await SecureStore.deleteItemAsync(BIOMETRIC_KEYS.FAILED_ATTEMPTS);
      logger.info('Biometric lockout expired and cleared');
    }
  }
};

/**
 * Record biometric authentication attempt
 * @param success - Whether the attempt succeeded
 * Throws error if max attempts exceeded
 */
export const recordBiometricAttempt = async (success: boolean): Promise<void> => {
  if (success) {
    // Clear biometric failed attempts on success
    await SecureStore.deleteItemAsync(BIOMETRIC_KEYS.FAILED_ATTEMPTS);
    await SecureStore.deleteItemAsync(BIOMETRIC_KEYS.LOCKOUT_UNTIL);

    // Also reset PIN attempts since user successfully authenticated
    await resetPinAttempts();

    logger.debug('Biometric auth successful - biometric and PIN attempts cleared');
    return;
  }

  // Increment biometric-specific counter
  const attemptsStr = await SecureStore.getItemAsync(BIOMETRIC_KEYS.FAILED_ATTEMPTS);
  const attempts = attemptsStr ? parseInt(attemptsStr, 10) + 1 : 1;

  await SecureStore.setItemAsync(BIOMETRIC_KEYS.FAILED_ATTEMPTS, attempts.toString(), DEVICE_ONLY);

  // SECURITY: Also increment unified PIN lockout counter so biometric failures
  // count toward the shared auth lockout (prevents lockout bypass via method switching)
  const pinState = await loadLockoutState();
  await recordFailedAttempt(pinState.failedAttempts);

  logger.warn('Biometric auth failed', { attempts, maxAttempts: BIOMETRIC_MAX_ATTEMPTS });

  if (attempts >= BIOMETRIC_MAX_ATTEMPTS) {
    const lockoutUntil = Date.now() + BIOMETRIC_LOCKOUT_MS;
    await SecureStore.setItemAsync(BIOMETRIC_KEYS.LOCKOUT_UNTIL, lockoutUntil.toString(), DEVICE_ONLY);

    logger.error('Biometric authentication locked out', {
      attempts,
      lockoutDurationMin: BIOMETRIC_LOCKOUT_MS / 60000,
    });

    throw new Error(
      `Too many failed biometric attempts (${attempts}/${BIOMETRIC_MAX_ATTEMPTS}). ` +
        `Locked out for 30 minutes. Please use your PIN instead.`
    );
  }
};

/**
 * Reset biometric failed attempt counter (call after any successful auth)
 */
export const resetBiometricAttempts = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(BIOMETRIC_KEYS.FAILED_ATTEMPTS);
  await SecureStore.deleteItemAsync(BIOMETRIC_KEYS.LOCKOUT_UNTIL);
};

/**
 * Check if device supports biometric authentication
 * @returns Whether biometrics are supported
 */
export const checkBiometricSupport = async (): Promise<boolean> => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  } catch (error: unknown) {
    logger.debug('Biometric support check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

/**
 * Authenticate user with biometrics (with rate limiting)
 * @param promptMessage - Message to display in auth prompt
 * @param fallbackLabel - Label for fallback option
 * @returns Authentication result
 */
export const authenticateWithBiometrics = async (
  promptMessage = 'Authenticate to access your wallet',
  fallbackLabel = 'Use PIN'
): Promise<BiometricResult> => {
  try {
    // SECURITY: Check if locked out before attempting authentication
    await checkBiometricLockout();

    // iPad in iPhone compatibility mode can cause the native biometric dialog
    // to hang or fail silently. Wrap with a timeout to prevent indefinite freeze.
    const authPromise = LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel,
      disableDeviceFallback: true,
    });

    const result = await Promise.race([
      authPromise,
      new Promise<LocalAuthentication.LocalAuthenticationResult>((_, reject) =>
        setTimeout(() => reject(new Error('Biometric authentication timed out')), BIOMETRIC_AUTH_TIMEOUT_MS)
      ),
    ]);

    // SECURITY: Record attempt for rate limiting
    await recordBiometricAttempt(result.success);

    return {
      success: result.success,
      error: result.success ? undefined : result.error,
    };
  } catch (error: unknown) {
    const err = error as Error;
    // If error is from lockout or rate limiting, propagate it
    if (err.message?.includes('Too many failed') || err.message?.includes('locked out')) {
      return {
        success: false,
        error: err.message,
      };
    }

    // Log timeout or other unexpected errors
    const isIPad = Platform.OS === 'ios' && (Platform as PlatformIOSStatic).isPad === true;
    logger.error('Biometric authentication error', {
      error: err.message,
      isIPad,
    });
    return {
      success: false,
      error: err.message,
    };
  }
};

/**
 * Check if user has enabled biometric authentication
 * @returns Whether biometrics are enabled
 */
export const isBiometricEnabled = async (): Promise<boolean> => {
  try {
    let enabled = await withTimeout(
      SecureStore.getItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED),
      5000, null, 'isBiometricEnabled',
    );

    if (enabled === null) {
      const legacyEnabled = await withTimeout(
        getPreferenceItem('biometricEnabled'),
        3000, null, 'isBiometricEnabled:legacy',
      );
      if (legacyEnabled !== null) {
        await setDeviceOnlyItem(SECURE_KEYS.BIOMETRIC_ENABLED, legacyEnabled);
        await deletePreferenceItem('biometricEnabled');
        enabled = legacyEnabled;
      }
    }

    return enabled === 'true';
  } catch (error: unknown) {
    logger.debug('Failed to check biometric enabled status', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

/**
 * Enable or disable biometric authentication
 * @param enabled - Whether to enable biometrics
 * @returns Success status
 */
export const setBiometricEnabled = async (enabled: boolean): Promise<boolean> => {
  try {
    await setDeviceOnlyItem(SECURE_KEYS.BIOMETRIC_ENABLED, enabled ? 'true' : 'false');
    await deletePreferenceItem('biometricEnabled');
    return true;
  } catch {
    return false;
  }
};
