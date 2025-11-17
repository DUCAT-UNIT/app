/**
 * Passkey Creation - Functions for creating wallets with passkeys
 */

import * as bip39 from 'bip39';
import * as SecureStore from 'expo-secure-store';
import { Passkey } from 'react-native-passkey';
import { SECURE_KEYS } from '../../utils/constants';
import { PASSKEY } from '../../constants/security';
import { deriveAddressesFromMnemonic } from '../../utils/bitcoin';
import { logger } from '../../utils/logger';
import { saveToICloud, loadFromICloud, checkICloudAvailability } from '../icloudStorage';
import { getRandomValues } from 'react-native-quick-crypto';

import { PASSKEY_KEYS, toBase64Url, fromBase64Url, isPasskeySupported } from './core';
import { generateRandomMnemonic, deriveEncryptionKey, encryptMnemonic } from './encryption';

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

    // Generate challenge and user ID
    const challenge = new Uint8Array(32);
    getRandomValues(challenge);

    const userId = new Uint8Array(16);
    getRandomValues(userId);

    // Create FIDO2 registration request
    const rp = { name: PASSKEY.RP_NAME };
    if (PASSKEY.RP_ID) {
      rp.id = PASSKEY.RP_ID;
    }

    const requestJson = {
      challenge: toBase64Url(challenge),
      rp,
      user: {
        id: toBase64Url(userId),
        name: userName || `user-${Date.now()}`,
        displayName: userDisplayName || 'Ducat User',
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      timeout: PASSKEY.TIMEOUT_MS,
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: PASSKEY.USER_VERIFICATION,
        residentKey: PASSKEY.RESIDENT_KEY,
      },
      attestation: PASSKEY.ATTESTATION,
    };

    logger.debug('Creating passkey credential...');

    // Create passkey credential
    const result = await Passkey.create(requestJson);

    logger.debug('Passkey credential created', { credentialId: result.id });

    // Extract stable identifiers from credential
    const credentialId = new Uint8Array(fromBase64Url(result.id));
    const userHandle = result.response.userHandle
      ? new Uint8Array(fromBase64Url(result.response.userHandle))
      : userId; // Fallback to userId if userHandle not provided

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

    // Save PIN for daily unlock (generates and saves salt)
    const { savePin } = await import('../pinService');
    await savePin(pin);

    // Get the PIN salt that was just created
    const pinSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
    // Validate salt format: 32 bytes = 64 hex characters
    if (!pinSalt || pinSalt.length !== 64 || !/^[0-9a-f]{64}$/i.test(pinSalt)) {
      throw new Error('Invalid or missing PIN salt - wallet creation failed');
    }

    // Derive encryption key from passkey + PIN with 10k iterations (Apple-proof!)
    // Uses RFC 5869 compliant HKDF
    const encryptionKey = await deriveEncryptionKey(credentialId, userHandle, pin, pinSalt);

    // Encrypt mnemonic for storage
    const { encrypted, iv, tag } = await encryptMnemonic(mnemonic, encryptionKey);

    // Store passkey data in SecureStore
    await SecureStore.setItemAsync(PASSKEY_KEYS.ENABLED, 'true');
    await SecureStore.setItemAsync(PASSKEY_KEYS.CREATION_METHOD, 'passkey');
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

    // Also store mnemonic in standard location (for backward compatibility)
    await SecureStore.setItemAsync(SECURE_KEYS.MNEMONIC, mnemonic);

    // Save current account (always 0 for new wallets)
    await SecureStore.setItemAsync(SECURE_KEYS.CURRENT_ACCOUNT, '0');

    // Backup encrypted mnemonic to iCloud (including PIN salt for recovery)
    let icloudBackupSucceeded = false;
    let icloudDebugInfo = '';
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
      icloudBackupSucceeded = true;
    } catch (icloudError) {
      icloudDebugInfo = icloudError.message;
      // iCloud backup failed - wallet still created but recovery won't work
      logger.error('CRITICAL: iCloud backup failed during wallet creation', {
        error: icloudError.message,
        errorCode: icloudError.code,
        errorName: icloudError.name,
        stack: icloudError.stack,
        hasICloudAccess: 'Check if user is signed into iCloud',
        hasStorageSpace: 'Check if iCloud storage is full',
        hasNetwork: 'Check if device has internet connection',
      });
      // Throw detailed error for TestFlight debugging
      throw new Error(`iCloud backup failed during wallet creation.\n\nError: ${icloudError.message}\nCode: ${icloudError.code || 'N/A'}\nName: ${icloudError.name || 'N/A'}\n\nCheck:\n- iCloud is enabled in Settings\n- Signed into iCloud\n- Has storage space\n- Has network connection`);
    }

    logger.debug('Wallet created with passkey successfully', {
      segwitAddress: addresses.segwitAddress,
      taprootAddress: addresses.taprootAddress,
      icloudBackup: icloudBackupSucceeded,
    });

    // Immediately verify the save worked by trying to load it back
    let verificationLog = '\n\n=== VERIFICATION (immediate read-back) ===\n';
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

    return {
      mnemonic,
      addresses,
      credentialId: Buffer.from(credentialId).toString('base64'),
      icloudBackupSucceeded,
      _iCloudDebug: icloudDebugInfo + verificationLog, // Debug info for TestFlight
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

    // Generate challenge and user ID
    const challenge = new Uint8Array(32);
    getRandomValues(challenge);

    const userId = new Uint8Array(16);
    getRandomValues(userId);

    // Create FIDO2 registration request
    const rp = { name: PASSKEY.RP_NAME };
    if (PASSKEY.RP_ID) {
      rp.id = PASSKEY.RP_ID;
    }

    const requestJson = {
      challenge: toBase64Url(challenge),
      rp,
      user: {
        id: toBase64Url(userId),
        name: userName || `user-${Date.now()}`,
        displayName: userDisplayName || 'Ducat User',
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      timeout: PASSKEY.TIMEOUT_MS,
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: PASSKEY.USER_VERIFICATION,
        residentKey: PASSKEY.RESIDENT_KEY,
      },
      attestation: PASSKEY.ATTESTATION,
    };

    // Create passkey credential
    const result = await Passkey.create(requestJson);

    const credentialId = new Uint8Array(fromBase64Url(result.id));
    const userHandle = result.response.userHandle
      ? new Uint8Array(fromBase64Url(result.response.userHandle))
      : userId;

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

    // Store passkey data
    await SecureStore.setItemAsync(PASSKEY_KEYS.ENABLED, 'true');
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

    // Backup to iCloud (including PIN salt)
    try {
      await saveToICloud({
        encrypted,
        iv,
        tag,
        credentialId: Buffer.from(credentialId).toString('base64'),
        userHandle: Buffer.from(userHandle).toString('base64'),
        pinSalt,
      });
      logger.debug('Passkey backup saved to iCloud');
    } catch (icloudError) {
      logger.error('CRITICAL: iCloud backup failed when adding passkey to wallet', {
        error: icloudError.message,
        errorCode: icloudError.code,
        errorName: icloudError.name,
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
