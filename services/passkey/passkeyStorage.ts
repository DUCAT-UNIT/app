/**
 * Passkey Data Storage Utilities
 * Functions for storing passkey data and encrypted mnemonics
 */

import * as SecureStore from 'expo-secure-store';
import { logger } from '../../utils/logger';
import { loadFromICloud, saveToICloud } from '../icloudStorage';
import { saveCurrentAccount, saveMnemonic } from '../secureStorageService';
import { PASSKEY_KEYS } from './core';

const DEVICE_ONLY = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

interface StorePasskeyDataParams {
  credentialId: Uint8Array;
  userHandle: Uint8Array;
  encrypted: string;
  iv: string;
  tag: string;
  creationMethod?: string;
}

interface BackupData {
  encrypted: string;
  iv: string;
  tag: string;
  credentialId: Uint8Array;
  userHandle: Uint8Array;
  pinSalt: string;
  pepper?: string;
  prfEnabled?: boolean;
  derivationVersion?: string;
}

interface BackupResult {
  debugInfo: string;
  verificationLog: string;
}

/**
 * Store passkey data in SecureStore
 */
export const storePasskeyData = async ({
  credentialId,
  userHandle,
  encrypted,
  iv,
  tag,
  creationMethod,
}: StorePasskeyDataParams): Promise<void> => {
  await SecureStore.setItemAsync(PASSKEY_KEYS.ENABLED, 'true', DEVICE_ONLY);

  if (creationMethod) {
    await SecureStore.setItemAsync(PASSKEY_KEYS.CREATION_METHOD, creationMethod, DEVICE_ONLY);
  }

  await SecureStore.setItemAsync(
    PASSKEY_KEYS.CREDENTIAL_ID,
    Buffer.from(credentialId).toString('base64'),
    DEVICE_ONLY
  );
  await SecureStore.setItemAsync(
    PASSKEY_KEYS.USER_HANDLE,
    Buffer.from(userHandle).toString('base64'),
    DEVICE_ONLY
  );
  await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTED_MNEMONIC, encrypted, DEVICE_ONLY);
  await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTION_IV, iv, DEVICE_ONLY);
  await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTION_TAG, tag, DEVICE_ONLY);
};

/**
 * Backup passkey data to iCloud with verification
 * @throws {Error} If backup fails
 */
export const backupToICloudWithVerification = async ({
  encrypted,
  iv,
  tag,
  credentialId,
  userHandle,
  pinSalt,
  pepper,
  prfEnabled,
  derivationVersion,
}: BackupData): Promise<BackupResult> => {
  let icloudDebugInfo = '';
  let verificationLog = '';

  try {
    icloudDebugInfo = await saveToICloud({
      encrypted,
      iv,
      tag,
      credentialId: Buffer.from(credentialId).toString('base64'),
      userHandle: Buffer.from(userHandle).toString('base64'),
      pinSalt, // CRITICAL: needed for PBKDF2 hashing on recovery
      pepper, // CRITICAL: needed for key derivation on recovery (added in v3)
      prfEnabled, // PRF extension flag for key derivation path (added in v4)
      derivationVersion, // Explicit key derivation version metadata (added in v5)
    });
    logger.debug('Encrypted backup saved to iCloud');

    // Immediately verify the save worked by trying to load it back
    verificationLog = '\n\n=== VERIFICATION (immediate read-back) ===\n';
    try {
      const verifyBackup = await loadFromICloud();
      verificationLog += '[ok] iCloud data verified - immediate read-back successful\n';
      verificationLog += `Keys found: ${Object.keys(verifyBackup)
        .filter((k) => k !== '_debugInfo')
        .join(', ')}\n`;
      if (verifyBackup._debugInfo) {
        verificationLog += '\n' + verifyBackup._debugInfo;
      }
    } catch (verifyError) {
      verificationLog += '[error] iCloud verification failed\n';
      verificationLog += (verifyError as Error).message;
    }

    return { debugInfo: icloudDebugInfo, verificationLog };
  } catch (icloudError) {
    // iCloud backup failed - wallet still created but recovery won't work
    const error = icloudError as Error & { code?: string; name?: string };
    logger.error('CRITICAL: iCloud backup failed', {
      error: error.message,
      errorCode: error.code,
      errorName: error.name,
      stack: error.stack,
      hasICloudAccess: 'Check if user is signed into iCloud',
      hasStorageSpace: 'Check if iCloud storage is full',
      hasNetwork: 'Check if device has internet connection',
    });

    // Preserve storage-provider details for support diagnostics.
    throw new Error(
      `iCloud backup failed.\n\n` +
        `Error: ${error.message}\n` +
        `Code: ${error.code || 'N/A'}\n` +
        `Name: ${error.name || 'N/A'}\n\n` +
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
 */
export const storeStandardMnemonic = async (mnemonic: string): Promise<void> => {
  await saveMnemonic(mnemonic);
};

/**
 * Set current account (always 0 for new wallets)
 */
export const setCurrentAccount = async (accountIndex = 0): Promise<void> => {
  const saved = await saveCurrentAccount(accountIndex);
  if (!saved) {
    throw new Error('Failed to save current account securely');
  }
};
