/**
 * Passkey PIN Change - Atomic PIN change with re-encryption
 */

import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { saveToICloud } from '../icloudStorage';
import { savePin } from '../pinService';

import { PASSKEY_KEYS } from './core';
import { deriveEncryptionKey, encryptMnemonic } from './encryption';
import { isPasskeyEnabled } from './storage';

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
  let timeoutId: NodeJS.Timeout | null = null;

  try {
    // Check if passkey is enabled
    const enabled = await isPasskeyEnabled();
    if (!enabled) {
      // No passkey, just change PIN normally
      const success = await savePin(newPin);
      return { success };
    }

    logger.debug('Starting atomic PIN change with passkey re-encryption');

    // Timeout protection: prevent operations from hanging indefinitely
    timeoutId = setTimeout(() => {
      pinChangeInProgress = false;
      throw new Error('PIN change timed out after 30 seconds - please try again');
    }, PIN_CHANGE_TIMEOUT_MS);

    // Step 1: Backup current state in case we need to rollback
    const oldPinHash = await SecureStore.getItemAsync(SECURE_KEYS.PIN);
    const oldPinSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
    const oldPinVersion = await SecureStore.getItemAsync(SECURE_KEYS.PIN_VERSION);
    const oldEncryptedMnemonic = await SecureStore.getItemAsync(PASSKEY_KEYS.ENCRYPTED_MNEMONIC);
    const oldIv = await SecureStore.getItemAsync(PASSKEY_KEYS.ENCRYPTION_IV);
    const oldTag = await SecureStore.getItemAsync(PASSKEY_KEYS.ENCRYPTION_TAG);

    try {
      // Step 2: Save new PIN (generates new salt)
      const pinSaveSuccess = await savePin(newPin);
      if (!pinSaveSuccess) {
        throw new Error('Failed to save new PIN');
      }

      // Step 3: Re-encrypt passkey mnemonic with new PIN salt
      // If this fails, we'll rollback the PIN change
      await reencryptPasskeyMnemonicAfterPinChange(newPin);

      // Clear timeout on success
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const duration = Date.now() - changeStartTime;
      logger.debug('Atomic PIN change completed successfully', { durationMs: duration });
      return { success: true };
    } catch (error: unknown) {
      // Clear timeout on error
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // Rollback: restore old PIN and passkey data
      logger.error('PIN change failed, rolling back to old PIN', { error: (error as Error).message });

      try {
        if (oldPinHash && oldPinSalt) {
          await SecureStore.setItemAsync(SECURE_KEYS.PIN, oldPinHash);
          await SecureStore.setItemAsync(SECURE_KEYS.PIN_SALT, oldPinSalt);
          if (oldPinVersion) {
            await SecureStore.setItemAsync(SECURE_KEYS.PIN_VERSION, oldPinVersion);
          }
        }
        if (oldEncryptedMnemonic && oldIv) {
          await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTED_MNEMONIC, oldEncryptedMnemonic);
          await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTION_IV, oldIv);
          if (oldTag) {
            await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTION_TAG, oldTag);
          }
        }
        logger.debug('Successfully rolled back to old PIN');
      } catch (rollbackError) {
        logger.error('CRITICAL: Rollback failed', { error: (rollbackError as Error).message });
        return {
          success: false,
          error: 'PIN change failed and rollback failed. Please contact support immediately.',
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
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
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

    // Get the mnemonic from standard storage (not passkey-encrypted storage)
    const mnemonic = await SecureStore.getItemAsync(SECURE_KEYS.MNEMONIC);
    if (!mnemonic) {
      throw new Error('Mnemonic not found');
    }

    // Get the NEW PIN salt (just created by savePin)
    const newPinSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
    // Validate salt format: 32 bytes = 64 hex characters
    if (!newPinSalt || newPinSalt.length !== 64 || !/^[0-9a-f]{64}$/i.test(newPinSalt)) {
      throw new Error('Invalid new PIN salt - cannot re-encrypt passkey data');
    }

    // Derive encryption key using passkey + NEW PIN with 10k iterations
    const encryptionKey = await deriveEncryptionKey(credentialId, userHandle, newPin, newPinSalt);

    // Encrypt mnemonic with new key
    const { encrypted, iv, tag } = await encryptMnemonic(mnemonic, encryptionKey);

    // Update passkey storage with new encrypted data
    await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTED_MNEMONIC, encrypted);
    await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTION_IV, iv);
    await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTION_TAG, tag);

    // Update iCloud backup with new encrypted data and new salt
    try {
      await saveToICloud({
        encrypted,
        iv,
        tag,
        credentialId: credentialIdBase64,
        userHandle: userHandleBase64,
        pinSalt: newPinSalt,
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
