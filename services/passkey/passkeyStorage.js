/**
 * Passkey Data Storage Utilities
 * Functions for storing passkey data and encrypted mnemonics
 */

import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { saveToICloud, loadFromICloud } from '../icloudStorage';
import { PASSKEY_KEYS } from './core';

/**
 * Store passkey data in SecureStore
 * @param {Object} data - Passkey data to store
 * @param {Uint8Array} data.credentialId - Credential ID
 * @param {Uint8Array} data.userHandle - User handle
 * @param {string} data.encrypted - Encrypted mnemonic
 * @param {string} data.iv - Encryption IV
 * @param {string} data.tag - Encryption tag
 * @param {string} [data.creationMethod] - How wallet was created (optional)
 * @returns {Promise<void>}
 */
export const storePasskeyData = async ({
  credentialId,
  userHandle,
  encrypted,
  iv,
  tag,
  creationMethod,
}) => {
  await SecureStore.setItemAsync(PASSKEY_KEYS.ENABLED, 'true');

  if (creationMethod) {
    await SecureStore.setItemAsync(PASSKEY_KEYS.CREATION_METHOD, creationMethod);
  }

  await SecureStore.setItemAsync(
    PASSKEY_KEYS.CREDENTIAL_ID,
    Buffer.from(credentialId).toString('base64')
  );
  await SecureStore.setItemAsync(
    PASSKEY_KEYS.USER_HANDLE,
    Buffer.from(userHandle).toString('base64')
  );
  await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTED_MNEMONIC, encrypted);
  await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTION_IV, iv);
  await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTION_TAG, tag);
};

/**
 * Backup passkey data to iCloud with verification
 * @param {Object} backupData - Data to backup
 * @param {string} backupData.encrypted - Encrypted mnemonic
 * @param {string} backupData.iv - Encryption IV
 * @param {string} backupData.tag - Encryption tag
 * @param {Uint8Array} backupData.credentialId - Credential ID
 * @param {Uint8Array} backupData.userHandle - User handle
 * @param {string} backupData.pinSalt - PIN salt for recovery
 * @returns {Promise<{debugInfo: string, verificationLog: string}>}
 * @throws {Error} If backup fails
 */
export const backupToICloudWithVerification = async ({
  encrypted,
  iv,
  tag,
  credentialId,
  userHandle,
  pinSalt,
}) => {
  let icloudDebugInfo = '';
  let verificationLog = '';

  try {
    icloudDebugInfo = await saveToICloud({
      encrypted,
      iv,
      tag,
      credentialId: Buffer.from(credentialId).toString('base64'),
      userHandle: Buffer.from(userHandle).toString('base64'),
      pinSalt, // CRITICAL: needed for 10k iteration hashing on recovery
    });
    logger.debug('Encrypted backup saved to iCloud');

    // Immediately verify the save worked by trying to load it back
    verificationLog = '\n\n=== VERIFICATION (immediate read-back) ===\n';
    try {
      const verifyBackup = await loadFromICloud();
      verificationLog += '✅ iCloud data verified - immediate read-back successful\n';
      verificationLog += `Keys found: ${Object.keys(verifyBackup).filter(k => k !== '_debugInfo').join(', ')}\n`;
      if (verifyBackup._debugInfo) {
        verificationLog += '\n' + verifyBackup._debugInfo;
      }
    } catch (verifyError) {
      verificationLog += '❌ iCloud verification failed\n';
      verificationLog += verifyError.message;
    }

    return { debugInfo: icloudDebugInfo, verificationLog };
  } catch (icloudError) {
    // iCloud backup failed - wallet still created but recovery won't work
    logger.error('CRITICAL: iCloud backup failed', {
      error: icloudError.message,
      errorCode: icloudError.code,
      errorName: icloudError.name,
      stack: icloudError.stack,
      hasICloudAccess: 'Check if user is signed into iCloud',
      hasStorageSpace: 'Check if iCloud storage is full',
      hasNetwork: 'Check if device has internet connection',
    });

    // Throw detailed error for debugging
    throw new Error(
      `iCloud backup failed.\n\n` +
      `Error: ${icloudError.message}\n` +
      `Code: ${icloudError.code || 'N/A'}\n` +
      `Name: ${icloudError.name || 'N/A'}\n\n` +
      `Check:\n` +
      `- iCloud is enabled in Settings\n` +
      `- Signed into iCloud\n` +
      `- Has storage space\n` +
      `- Has network connection`
    );
  }
};

/**
 * Store mnemonic in standard location for backward compatibility
 * @param {string} mnemonic - Mnemonic to store
 * @returns {Promise<void>}
 */
export const storeStandardMnemonic = async (mnemonic) => {
  await SecureStore.setItemAsync(SECURE_KEYS.MNEMONIC, mnemonic);
};

/**
 * Set current account (always 0 for new wallets)
 * @param {number} accountIndex - Account index
 * @returns {Promise<void>}
 */
export const setCurrentAccount = async (accountIndex = 0) => {
  await SecureStore.setItemAsync(SECURE_KEYS.CURRENT_ACCOUNT, accountIndex.toString());
};
