/**
 * Passkey Storage - Storage management and data clearing
 */

import * as SecureStore from 'expo-secure-store';
import { logger } from '../../utils/logger';
import { clearICloud } from '../icloudStorage';

import { PASSKEY_KEYS } from './core';

/**
 * Check if passkey is enabled for current wallet
 * @returns {Promise<boolean>}
 */
export const isPasskeyEnabled = async () => {
  try {
    const enabled = await SecureStore.getItemAsync(PASSKEY_KEYS.ENABLED);
    return enabled === 'true';
  } catch (error) {
    return false;
  }
};

/**
 * Get wallet creation method
 * @returns {Promise<'passkey'|'pin'|null>}
 */
export const getWalletCreationMethod = async () => {
  try {
    const method = await SecureStore.getItemAsync(PASSKEY_KEYS.CREATION_METHOD);
    return method || null;
  } catch (error) {
    return null;
  }
};

/**
 * Remove passkey from wallet (keep PIN/biometric)
 * @returns {Promise<void>}
 */
export const removePasskey = async () => {
  try {
    logger.debug('Removing passkey from wallet');

    await SecureStore.deleteItemAsync(PASSKEY_KEYS.ENABLED);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.CREDENTIAL_ID);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.USER_HANDLE);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.ENCRYPTED_MNEMONIC);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.ENCRYPTION_IV);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.ENCRYPTION_TAG);

    // Don't delete CREATION_METHOD or main mnemonic - wallet still exists

    logger.debug('Passkey removed successfully');
  } catch (error) {
    logger.error('Failed to remove passkey', { error: error.message });
    throw error;
  }
};

/**
 * Clear local passkey data (for wallet deletion on this device)
 * NOTE: iCloud backup is intentionally NOT cleared to allow restoration on same device
 * @param {boolean} clearICloudBackup - Optional: if true, also clears iCloud backup
 * @returns {Promise<void>}
 */
export const clearPasskeyData = async (clearICloudBackup = false) => {
  try {
    // Clear local secure storage
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.ENABLED);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.CREATION_METHOD);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.CREDENTIAL_ID);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.USER_HANDLE);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.ENCRYPTED_MNEMONIC);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.ENCRYPTION_IV);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.ENCRYPTION_TAG);

    logger.debug('Local passkey data cleared');

    // Only clear iCloud backup if explicitly requested
    if (clearICloudBackup) {
      try {
        await clearICloud();
        logger.debug('iCloud backup also cleared');
      } catch (icloudError) {
        logger.warn('Failed to clear iCloud backup', { error: icloudError.message });
      }
    } else {
      logger.debug('iCloud backup preserved for restoration');
    }
  } catch (error) {
    logger.error('Failed to clear passkey data', { error: error.message });
  }
};
