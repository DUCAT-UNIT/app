/**
 * Passkey Storage - Storage management and data clearing
 */

import * as SecureStore from 'expo-secure-store';
import { logger } from '../../utils/logger';
import { withTimeout } from '../../utils/withTimeout';
import { clearICloud } from '../icloudStorage';

import {
  isLegacyPasskeyDerivationVersion,
  type PasskeyDerivationVersion,
  PASSKEY_KEYS,
  resolvePasskeyDerivationVersion,
} from './core';

const PASSKEY_STORAGE_READ_TIMEOUT_MS = 5000;

/**
 * Check if passkey is enabled for current wallet
 */
export const isPasskeyEnabled = async (): Promise<boolean> => {
  try {
    const enabled = await withTimeout(
      SecureStore.getItemAsync(PASSKEY_KEYS.ENABLED),
      PASSKEY_STORAGE_READ_TIMEOUT_MS,
      null,
      'passkey:isEnabled',
    );
    return enabled === 'true';
  } catch (error: unknown) {
    return false;
  }
};

/**
 * Get wallet creation method
 */
export const getWalletCreationMethod = async (): Promise<'passkey' | 'pin' | null> => {
  try {
    const method = await withTimeout(
      SecureStore.getItemAsync(PASSKEY_KEYS.CREATION_METHOD),
      PASSKEY_STORAGE_READ_TIMEOUT_MS,
      null,
      'passkey:getWalletCreationMethod',
    );
    return (method as 'passkey' | 'pin') || null;
  } catch (error: unknown) {
    return null;
  }
};

export const getPasskeyDerivationVersion = async (): Promise<PasskeyDerivationVersion | null> => {
  try {
    const [storedVersion, prfEnabled] = await Promise.all([
      withTimeout(
        SecureStore.getItemAsync(PASSKEY_KEYS.DERIVATION_VERSION),
        PASSKEY_STORAGE_READ_TIMEOUT_MS,
        null,
        'passkey:getDerivationVersion',
      ),
      withTimeout(
        SecureStore.getItemAsync(PASSKEY_KEYS.PRF_ENABLED),
        PASSKEY_STORAGE_READ_TIMEOUT_MS,
        null,
        'passkey:getPrfEnabled',
      ),
    ]);
    return resolvePasskeyDerivationVersion(storedVersion, prfEnabled === 'true');
  } catch (error: unknown) {
    logger.warn('Failed to read passkey derivation version', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

export const isPasskeyUpgradeRecommended = async (): Promise<boolean> => {
  const derivationVersion = await getPasskeyDerivationVersion();
  return derivationVersion ? isLegacyPasskeyDerivationVersion(derivationVersion) : false;
};

/**
 * Remove passkey from wallet (keep PIN/biometric)
 */
export const removePasskey = async (): Promise<void> => {
  try {
    logger.debug('Removing passkey from wallet');

    await SecureStore.deleteItemAsync(PASSKEY_KEYS.ENABLED);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.CREDENTIAL_ID);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.USER_HANDLE);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.ENCRYPTED_MNEMONIC);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.ENCRYPTION_IV);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.ENCRYPTION_TAG);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.PRF_ENABLED);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.DERIVATION_VERSION);

    // Don't delete CREATION_METHOD or main mnemonic - wallet still exists

    logger.debug('Passkey removed successfully');
  } catch (error: unknown) {
    logger.error('Failed to remove passkey', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Clear local passkey data (for wallet deletion on this device)
 * NOTE: iCloud backup is intentionally NOT cleared to allow restoration on same device
 * @param clearICloudBackup - Optional: if true, also clears iCloud backup
 */
export const clearPasskeyData = async (clearICloudBackup = false): Promise<void> => {
  try {
    // Clear local secure storage
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.ENABLED);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.CREATION_METHOD);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.CREDENTIAL_ID);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.USER_HANDLE);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.ENCRYPTED_MNEMONIC);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.ENCRYPTION_IV);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.ENCRYPTION_TAG);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.PRF_ENABLED);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.DERIVATION_VERSION);

    logger.debug('Local passkey data cleared');

    // Only clear iCloud backup if explicitly requested
    if (clearICloudBackup) {
      try {
        await clearICloud();
        logger.debug('iCloud backup also cleared');
      } catch (icloudError) {
        logger.warn('Failed to clear iCloud backup', { error: (icloudError as Error).message });
      }
    } else {
      logger.debug('iCloud backup preserved for restoration');
    }
  } catch (error: unknown) {
    logger.error('Failed to clear passkey data', { error: (error as Error).message });
  }
};
