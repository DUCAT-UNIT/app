/**
 * Passkey PIN Change - Atomic PIN change with re-encryption
 */

import * as SecureStore from 'expo-secure-store';
import { Passkey } from 'react-native-passkey';
import type { PasskeyGetRequest } from 'react-native-passkey';
import { SECURE_KEYS } from '../../utils/constants';
import { PASSKEY } from '../../constants/security';
import { logger } from '../../utils/logger';
import { saveToICloud } from '../icloudStorage';
import { savePin } from '../pinService';
import { withMnemonic } from '../secureStorageService';
const { getRandomValues } = require('react-native-quick-crypto');

const PASSKEY_NATIVE_TIMEOUT_MS = 30000;

const withPasskeyTimeout = <T>(promise: Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Passkey authentication timed out — please try again')),
      PASSKEY_NATIVE_TIMEOUT_MS,
    );
    (timeout as { unref?: () => void }).unref?.();

    promise.then(resolve, reject).finally(() => clearTimeout(timeout));
  });

import {
  PASSKEY_DERIVATION_VERSION,
  PASSKEY_KEYS,
  PRF_SALT,
  resolvePasskeyDerivationVersion,
  toBase64Url,
} from './core';
import { deriveEncryptionKey, encryptMnemonic } from './encryption';
import { isPasskeyEnabled } from './storage';

const DEVICE_ONLY = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

// Module-level lock to prevent concurrent PIN changes
let pinChangeInProgress = false;
const PIN_CHANGE_TIMEOUT_MS = 30000; // 30 seconds max

// Reset function for testing only
export const _resetPinChangeState = (): void => {
  pinChangeInProgress = false;
};

interface PinChangeResult {
  success: boolean;
  error?: string;
}

/**
 * Atomically change PIN and re-encrypt passkey data with rollback capability
 * CRITICAL: This operation must be atomic to prevent lockout scenarios
 * If passkey re-encryption fails, the old PIN is restored
 */
export const atomicPinChangeWithPasskey = async (newPin: string): Promise<PinChangeResult> => {
  // SECURITY: Prevent concurrent PIN changes that could corrupt passkey encryption
  if (pinChangeInProgress) {
    throw new Error('PIN change already in progress. Please wait and try again.');
  }

  pinChangeInProgress = true;
  const changeStartTime = Date.now();

  try {
    // Check if passkey is enabled
    const enabled = await isPasskeyEnabled();
    if (!enabled) {
      // No passkey, just change PIN normally
      const success = await savePin(newPin);
      return { success };
    }

    logger.debug('Starting atomic PIN change with passkey re-encryption');

    // Step 1: Backup current state in case we need to rollback
    const oldPinHash = await SecureStore.getItemAsync(SECURE_KEYS.PIN);
    const oldPinSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
    const oldPinVersion = await SecureStore.getItemAsync(SECURE_KEYS.PIN_VERSION);
    const oldEncryptedMnemonic = await SecureStore.getItemAsync(PASSKEY_KEYS.ENCRYPTED_MNEMONIC);
    const oldIv = await SecureStore.getItemAsync(PASSKEY_KEYS.ENCRYPTION_IV);
    const oldTag = await SecureStore.getItemAsync(PASSKEY_KEYS.ENCRYPTION_TAG);

    // Helper to rollback PIN and passkey data to pre-change state
    const rollback = async (reason: string): Promise<void> => {
      logger.error('PIN change failed, rolling back to old PIN', { reason });
      try {
        if (oldPinHash && oldPinSalt) {
          await SecureStore.setItemAsync(SECURE_KEYS.PIN, oldPinHash, DEVICE_ONLY);
          await SecureStore.setItemAsync(SECURE_KEYS.PIN_SALT, oldPinSalt, DEVICE_ONLY);
          if (oldPinVersion) {
            await SecureStore.setItemAsync(SECURE_KEYS.PIN_VERSION, oldPinVersion, DEVICE_ONLY);
          }
        }
        if (oldEncryptedMnemonic && oldIv) {
          await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTED_MNEMONIC, oldEncryptedMnemonic, DEVICE_ONLY);
          await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTION_IV, oldIv, DEVICE_ONLY);
          if (oldTag) {
            await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTION_TAG, oldTag, DEVICE_ONLY);
          }
        }
        logger.debug('Successfully rolled back to old PIN');
      } catch (rollbackError) {
        logger.error('CRITICAL: Rollback failed', { error: (rollbackError as Error).message });
        throw new Error(
          'PIN change failed and rollback failed. Please contact support immediately.'
        );
      }
    };

    // Timeout protection via Promise.race: guarantees rollback on timeout
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('PIN change timed out after 30 seconds'));
      }, PIN_CHANGE_TIMEOUT_MS);
      (timeoutId as { unref?: () => void }).unref?.();
    });

    const pinChangeWork = async (): Promise<PinChangeResult> => {
      // Step 2: Save new PIN (generates new salt)
      const pinSaveSuccess = await savePin(newPin);
      if (!pinSaveSuccess) {
        throw new Error('Failed to save new PIN');
      }

      // Step 3: Re-encrypt passkey mnemonic with new PIN salt
      // If this fails, we'll rollback the PIN change
      await reencryptPasskeyMnemonicAfterPinChange(newPin);

      const duration = Date.now() - changeStartTime;
      logger.debug('Atomic PIN change completed successfully', { durationMs: duration });
      return { success: true };
    };

    try {
      return await Promise.race([pinChangeWork(), timeoutPromise]).finally(() => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      });
    } catch (error: unknown) {
      // Rollback on any failure (including timeout)
      try {
        await rollback((error as Error).message);
      } catch (rollbackError) {
        return {
          success: false,
          error: (rollbackError as Error).message,
        };
      }

      return { success: false, error: 'PIN change failed. Your old PIN is still active.' };
    }
  } catch (error: unknown) {
    logger.error('Atomic PIN change failed', { error: (error as Error).message });
    return { success: false, error: (error as Error).message || 'Failed to change PIN' };
  } finally {
    // CRITICAL: Always release the lock, even if an error occurred
    pinChangeInProgress = false;
  }
};

/**
 * Re-encrypt passkey mnemonic with new PIN salt (called after PIN change)
 * CRITICAL: Must be called when PIN changes, otherwise passkey unlock will fail
 */
export const reencryptPasskeyMnemonicAfterPinChange = async (newPin: string): Promise<void> => {
  try {
    // Check if passkey is enabled
    const enabled = await isPasskeyEnabled();
    if (!enabled) {
      logger.debug('Passkey not enabled, skipping re-encryption');
      return;
    }

    logger.debug('Re-encrypting passkey mnemonic with new PIN salt');

    // Get current passkey data
    const credentialIdBase64 = await SecureStore.getItemAsync(PASSKEY_KEYS.CREDENTIAL_ID);
    const userHandleBase64 = await SecureStore.getItemAsync(PASSKEY_KEYS.USER_HANDLE);

    if (!credentialIdBase64 || !userHandleBase64) {
      throw new Error('Passkey credentials not found');
    }

    const credentialId = new Uint8Array(Buffer.from(credentialIdBase64, 'base64'));
    const userHandle = new Uint8Array(Buffer.from(userHandleBase64, 'base64'));

    // Check if PRF was enabled for this wallet
    const prfEnabledFlag = await SecureStore.getItemAsync(PASSKEY_KEYS.PRF_ENABLED);
    const storedDerivationVersion = await SecureStore.getItemAsync(PASSKEY_KEYS.DERIVATION_VERSION);
    const derivationVersion = resolvePasskeyDerivationVersion(
      storedDerivationVersion,
      prfEnabledFlag === 'true'
    );
    const usePrf = derivationVersion === PASSKEY_DERIVATION_VERSION.PRF_V5;

    // If PRF is enabled, we need a fresh assertion to get the PRF secret
    let prfSecret: Uint8Array | null = null;
    if (usePrf) {
      logger.debug('PRF enabled - requesting passkey assertion for re-encryption');
      const challenge = new Uint8Array(32);
      getRandomValues(challenge);

      const requestJson: PasskeyGetRequest = {
        challenge: toBase64Url(challenge),
        userVerification: PASSKEY.USER_VERIFICATION,
        allowCredentials: [
          {
            id: credentialIdBase64,
            type: 'public-key',
          },
        ],
        timeout: PASSKEY.TIMEOUT_MS,
        rpId: PASSKEY.RP_ID,
        extensions: {
          prf: {
            eval: { first: PRF_SALT },
          },
        },
      };

      const authResult = await withPasskeyTimeout(Passkey.get(requestJson));
      const prfResultRaw = authResult.clientExtensionResults?.prf?.results?.first ?? null;
      prfSecret = prfResultRaw
        ? (prfResultRaw instanceof Uint8Array ? prfResultRaw : new Uint8Array(prfResultRaw))
        : null;

      if (!prfSecret) {
        throw new Error('PRF result missing from authenticator during PIN change re-encryption');
      }
      logger.debug('PRF secret obtained for re-encryption');
    }

    const mnemonic = await withMnemonic(async (seed) => seed);

    // Get the NEW PIN salt (just created by savePin)
    const newPinSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
    // Validate salt format: 32 bytes = 64 hex characters
    if (!newPinSalt || newPinSalt.length !== 64 || !/^[0-9a-f]{64}$/i.test(newPinSalt)) {
      throw new Error('Invalid new PIN salt - cannot re-encrypt passkey data');
    }

    // Derive encryption key using NEW PIN + PRF secret (or credential IDs for legacy)
    const encryptionKey = await deriveEncryptionKey(
      credentialId, userHandle, newPin, newPinSalt, false, prfSecret
    );

    // Encrypt mnemonic with new key
    const { encrypted, iv, tag } = await encryptMnemonic(mnemonic, encryptionKey);

    // Update passkey storage with new encrypted data
    await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTED_MNEMONIC, encrypted, DEVICE_ONLY);
    await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTION_IV, iv, DEVICE_ONLY);
    await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTION_TAG, tag, DEVICE_ONLY);

    // Read pepper for inclusion in iCloud backup (critical for cross-device recovery)
    const pepper = await SecureStore.getItemAsync(SECURE_KEYS.PASSKEY_PEPPER);
    if (!pepper) {
      logger.warn('Pepper not found during PIN change - iCloud backup will lack pepper');
    }

    // Update iCloud backup with new encrypted data and new salt
    try {
      await saveToICloud({
        encrypted,
        iv,
        tag,
        credentialId: credentialIdBase64,
        userHandle: userHandleBase64,
        pinSalt: newPinSalt,
        pepper: pepper || undefined,
        prfEnabled: usePrf,
        derivationVersion,
      });
      logger.debug('Updated iCloud backup with re-encrypted mnemonic');
    } catch (icloudError) {
      const error = icloudError as Error & { code?: string; name?: string };
      logger.error('CRITICAL: iCloud backup failed after PIN change', {
        error: error.message,
        errorCode: error.code,
        errorName: error.name,
        impact: 'Old PIN salt still in iCloud - recovery may fail on new devices',
        recommendation: 'User should retry PIN change or check iCloud settings',
      });
      // Don't throw - local passkey is updated, just iCloud sync failed
      // User can still unlock on this device
    }

    logger.debug('Passkey mnemonic re-encrypted successfully with new PIN salt');
  } catch (error: unknown) {
    logger.error('Failed to re-encrypt passkey mnemonic after PIN change', {
      error: (error as Error).message,
    });
    throw new Error('Failed to update passkey encryption with new PIN');
  }
};
