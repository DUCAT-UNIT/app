/**
 * Passkey Creation - Functions for creating wallets with passkeys
 */

import * as bip39 from 'bip39';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../../utils/constants';
import { deriveAddressesFromMnemonic } from '../../utils/bitcoin';
import { logger } from '../../utils/logger';
import { checkICloudAvailability } from '../icloudStorage';

import { isPasskeySupported } from './core';
import { generateRandomMnemonic, deriveEncryptionKey, encryptMnemonic } from './encryption';
import { createPasskeyCredential } from './credentialCreation';
import {
  storePasskeyData,
  backupToICloudWithVerification,
  storeStandardMnemonic,
  setCurrentAccount,
} from './passkeyStorage';

/**
 * Create a new wallet with passkey
 * Generates passkey → random mnemonic → encrypts with passkey+PIN → backs up to iCloud
 *
 * @param {Object} options - Configuration options
 * @param {string} options.userName - User identifier (email or username)
 * @param {string} options.userDisplayName - Display name for the user
 * @param {string} options.pin - User's 6-digit PIN (for Apple-proof encryption)
 * @returns {Promise<{mnemonic: string, addresses: Object, credentialId: string}>}
 */
export const createWalletWithPasskey = async ({ userName, userDisplayName, pin }) => {
  let createDebugLog = '=== WALLET CREATION DEBUG LOG ===\n\n';
  try {
    createDebugLog += `Step 1: Checking passkey support...\n`;
    logger.debug('Creating wallet with passkey', { userName });

    // Check if passkeys are supported
    const supported = await isPasskeySupported();
    if (!supported) {
      throw new Error(createDebugLog + '❌ Passkeys not supported on this device');
    }
    createDebugLog += `✅ Passkeys supported\n\n`;

    // Check iCloud availability
    createDebugLog += `Step 2: Checking iCloud availability...\n`;
    const iCloudCheck = await checkICloudAvailability();
    if (!iCloudCheck.available) {
      throw new Error(createDebugLog + `❌ iCloud not available: ${iCloudCheck.error}\n\nPlease check:\n1. Settings > [Your Name] > iCloud - ensure you're signed in\n2. Settings > [Your Name] > iCloud > iCloud Drive - ensure it's enabled`);
    }
    createDebugLog += `✅ iCloud is available\n\n`;

    // Create passkey credential
    const { credentialId, userHandle } = await createPasskeyCredential(userName, userDisplayName);

    logger.debug('Generating random mnemonic...');

    // Generate random BIP39 mnemonic (NOT derived from passkey)
    const mnemonic = generateRandomMnemonic();

    logger.debug('Random mnemonic generated successfully');

    // Derive wallet addresses (account 0)
    const addresses = deriveAddressesFromMnemonic(mnemonic, 0);

    // Validate PIN
    if (!pin || pin.length !== 6) {
      throw new Error('PIN is required for passkey wallet creation');
    }

    // Save PIN for daily unlock (generates and saves salt + hash)
    // OPTIMIZATION: Returns the hashed PIN to avoid re-hashing (10k iterations = ~500ms)
    const { savePinWithHash } = await import('../pinService');
    const { hashedPin, salt: pinSalt } = await savePinWithHash(pin);

    // Validate salt format: 32 bytes = 64 hex characters
    if (!pinSalt || pinSalt.length !== 64 || !/^[0-9a-f]{64}$/i.test(pinSalt)) {
      throw new Error('Invalid or missing PIN salt - wallet creation failed');
    }

    // Derive encryption key from passkey + hashed PIN
    // OPTIMIZATION: Pass pre-hashed PIN to skip 10k PBKDF2 iterations (~500ms saved)
    // Uses RFC 5869 compliant HKDF
    const encryptionKey = await deriveEncryptionKey(credentialId, userHandle, hashedPin, pinSalt, true);

    // Encrypt mnemonic for storage
    const { encrypted, iv, tag } = await encryptMnemonic(mnemonic, encryptionKey);

    // Store passkey data in SecureStore
    await storePasskeyData({
      credentialId,
      userHandle,
      encrypted,
      iv,
      tag,
      creationMethod: 'passkey',
    });

    // Also store mnemonic in standard location (for backward compatibility)
    await storeStandardMnemonic(mnemonic);

    // Save current account (always 0 for new wallets)
    await setCurrentAccount(0);

    logger.debug('Wallet created with passkey successfully (before iCloud backup)', {
      segwitAddress: addresses.segwitAddress,
      taprootAddress: addresses.taprootAddress,
    });

    // Return immediately with backup promise for async execution
    // This allows UI to proceed while backup happens in background
    const backupPromise = backupToICloudWithVerification({
      encrypted,
      iv,
      tag,
      credentialId,
      userHandle,
      pinSalt,
    }).then((backup) => {
      logger.debug('iCloud backup succeeded', backup);
      return { success: true, debugInfo: backup.debugInfo + backup.verificationLog };
    }).catch((icloudError) => {
      logger.error('iCloud backup failed (non-blocking)', { error: icloudError.message });
      return { success: false, error: icloudError.message };
    });

    return {
      mnemonic,
      addresses,
      credentialId: Buffer.from(credentialId).toString('base64'),
      icloudBackupPromise: backupPromise, // Return promise for background execution
    };
  } catch (error) {
    logger.error('Failed to create wallet with passkey', { error: error.message });
    // Include full debug log in error
    if (error.message && error.message.includes('=== WALLET CREATION DEBUG LOG ===')) {
      throw error;
    } else {
      throw new Error(createDebugLog + `\n\n❌ ERROR: ${error.message}\nStack: ${error.stack || 'N/A'}`);
    }
  }
};

/**
 * Add passkey to existing wallet (migration)
 * Encrypts existing mnemonic with passkey + PIN for future unlocks
 *
 * @param {string} mnemonic - Existing wallet mnemonic
 * @param {string} userName - User identifier
 * @param {string} userDisplayName - Display name
 * @param {string} pin - User's PIN
 * @returns {Promise<{credentialId: string}>}
 */
export const addPasskeyToExistingWallet = async (mnemonic, userName, userDisplayName, pin) => {
  try {
    logger.debug('Adding passkey to existing wallet');

    // Validate mnemonic
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic');
    }

    // Check if passkeys are supported
    const supported = await isPasskeySupported();
    if (!supported) {
      throw new Error('Passkeys are not supported on this device');
    }

    // Create passkey credential
    const { credentialId, userHandle } = await createPasskeyCredential(userName, userDisplayName);

    // Validate PIN
    if (!pin || pin.length !== 6) {
      throw new Error('PIN is required for passkey encryption');
    }

    // Check if PIN salt already exists, or create new one
    let pinSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
    if (!pinSalt) {
      // No existing salt - save PIN to create one
      const { savePin } = await import('../pinService');
      await savePin(pin);
      pinSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
    }

    // Validate salt format: 32 bytes = 64 hex characters
    if (!pinSalt || pinSalt.length !== 64 || !/^[0-9a-f]{64}$/i.test(pinSalt)) {
      throw new Error('Invalid or missing PIN salt - cannot add passkey to wallet');
    }

    // Derive encryption key using passkey + PIN (with 10k iterations)
    const encryptionKey = await deriveEncryptionKey(credentialId, userHandle, pin, pinSalt);

    // Encrypt existing mnemonic
    const { encrypted, iv, tag } = await encryptMnemonic(mnemonic, encryptionKey);

    // Store passkey data (no creation method - wallet already exists)
    await storePasskeyData({
      credentialId,
      userHandle,
      encrypted,
      iv,
      tag,
    });

    // Backup to iCloud (including PIN salt)
    try {
      await backupToICloudWithVerification({
        encrypted,
        iv,
        tag,
        credentialId,
        userHandle,
        pinSalt,
      });
      logger.debug('Passkey backup saved to iCloud');
    } catch (icloudError) {
      logger.error('CRITICAL: iCloud backup failed when adding passkey to wallet', {
        error: icloudError.message,
        recommendation: 'User should check iCloud settings and retry adding passkey',
      });
      // Re-throw so caller knows backup failed
      throw new Error(`Failed to backup passkey to iCloud: ${icloudError.message}. Recovery may not work on new devices.`);
    }

    logger.debug('Passkey added to wallet successfully');

    return {
      credentialId: Buffer.from(credentialId).toString('base64'),
    };
  } catch (error) {
    logger.error('Failed to add passkey to wallet', { error: error.message });
    throw error;
  }
};
