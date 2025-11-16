/**
 * iCloud Storage Service
 * Provides encrypted backup storage to iCloud for wallet recovery across devices
 */

import iCloudStorage from 'react-native-icloudstore';
import { logger } from '../utils/logger';

// iCloud keys
const ICLOUD_KEYS = {
  ENCRYPTED_MNEMONIC: 'ducat_encrypted_mnemonic_v1',
  ENCRYPTION_IV: 'ducat_encryption_iv_v1',
  ENCRYPTION_TAG: 'ducat_encryption_tag_v1',
  CREDENTIAL_ID: 'ducat_credential_id_v1',
  USER_HANDLE: 'ducat_user_handle_v1',
  PIN_SALT: 'ducat_pin_salt_v1', // CRITICAL: Salt for 10k iteration PIN hashing
};

/**
 * Save encrypted mnemonic to iCloud
 * @param {Object} data - Encrypted mnemonic data
 * @param {string} data.encrypted - Base64 encrypted mnemonic
 * @param {string} data.iv - Base64 IV
 * @param {string} data.tag - Base64 authentication tag
 * @param {string} data.credentialId - Base64 credential ID
 * @param {string} data.userHandle - Base64 user handle
 * @param {string} data.pinSalt - Hex PIN salt for 10k iteration hashing (CRITICAL for recovery)
 */
export const saveToICloud = async ({ encrypted, iv, tag, credentialId, userHandle, pinSalt }) => {
  try {
    logger.debug('Saving encrypted mnemonic to iCloud', {
      hasEncrypted: !!encrypted,
      hasIv: !!iv,
      hasTag: !!tag,
      hasCredentialId: !!credentialId,
      hasUserHandle: !!userHandle,
      hasPinSalt: !!pinSalt,
    });

    await iCloudStorage.setItem(ICLOUD_KEYS.ENCRYPTED_MNEMONIC, encrypted);
    await iCloudStorage.setItem(ICLOUD_KEYS.ENCRYPTION_IV, iv);
    await iCloudStorage.setItem(ICLOUD_KEYS.ENCRYPTION_TAG, tag);
    await iCloudStorage.setItem(ICLOUD_KEYS.CREDENTIAL_ID, credentialId);
    await iCloudStorage.setItem(ICLOUD_KEYS.USER_HANDLE, userHandle);
    await iCloudStorage.setItem(ICLOUD_KEYS.PIN_SALT, pinSalt);

    logger.debug('Successfully saved to iCloud');
  } catch (error) {
    logger.error('Failed to save to iCloud', {
      error: error.message,
      errorCode: error.code,
      errorName: error.name,
    });
    throw new Error('Failed to backup wallet to iCloud: ' + error.message);
  }
};

/**
 * Load encrypted mnemonic from iCloud
 * @returns {Promise<Object|null>} Encrypted mnemonic data or null if not found
 */
export const loadFromICloud = async () => {
  try {
    logger.debug('Loading encrypted mnemonic from iCloud');

    const encrypted = await iCloudStorage.getItem(ICLOUD_KEYS.ENCRYPTED_MNEMONIC);

    if (!encrypted) {
      logger.debug('No backup found in iCloud');
      return null;
    }

    const iv = await iCloudStorage.getItem(ICLOUD_KEYS.ENCRYPTION_IV);
    const tag = await iCloudStorage.getItem(ICLOUD_KEYS.ENCRYPTION_TAG);
    const credentialId = await iCloudStorage.getItem(ICLOUD_KEYS.CREDENTIAL_ID);
    const userHandle = await iCloudStorage.getItem(ICLOUD_KEYS.USER_HANDLE);
    const pinSalt = await iCloudStorage.getItem(ICLOUD_KEYS.PIN_SALT);

    if (!iv || !credentialId || !userHandle || !pinSalt) {
      logger.error('Incomplete backup data in iCloud', {
        hasIv: !!iv,
        hasCredentialId: !!credentialId,
        hasUserHandle: !!userHandle,
        hasPinSalt: !!pinSalt,
      });
      throw new Error('Backup data is corrupted');
    }

    logger.debug('Successfully loaded from iCloud');

    return {
      encrypted,
      iv,
      tag,
      credentialId,
      userHandle,
      pinSalt,
    };
  } catch (error) {
    logger.error('Failed to load from iCloud', { error: error.message });
    throw error;
  }
};

/**
 * Check if iCloud backup exists
 * @returns {Promise<boolean>}
 */
export const hasICloudBackup = async () => {
  try {
    const encrypted = await iCloudStorage.getItem(ICLOUD_KEYS.ENCRYPTED_MNEMONIC);
    return !!encrypted;
  } catch (error) {
    logger.error('Failed to check iCloud backup', { error: error.message });
    return false;
  }
};

/**
 * Clear all data from iCloud (for wallet deletion)
 */
export const clearICloud = async () => {
  try {
    logger.debug('Clearing iCloud backup');

    await iCloudStorage.removeItem(ICLOUD_KEYS.ENCRYPTED_MNEMONIC);
    await iCloudStorage.removeItem(ICLOUD_KEYS.ENCRYPTION_IV);
    await iCloudStorage.removeItem(ICLOUD_KEYS.ENCRYPTION_TAG);
    await iCloudStorage.removeItem(ICLOUD_KEYS.CREDENTIAL_ID);
    await iCloudStorage.removeItem(ICLOUD_KEYS.USER_HANDLE);
    await iCloudStorage.removeItem(ICLOUD_KEYS.PIN_SALT);

    logger.debug('iCloud backup cleared');
  } catch (error) {
    logger.error('Failed to clear iCloud backup', { error: error.message });
    throw error;
  }
};
