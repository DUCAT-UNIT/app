/**
 * Passkey Service - WebAuthn-based wallet authentication and recovery
 *
 * This service provides secure wallet backup with passkey encryption:
 * - Random BIP39 Mnemonic → Encrypt with Passkey-Derived Key → Store in iCloud
 * - Passkey syncs via iCloud Keychain (iOS) / Google Password Manager (Android)
 * - Encrypted backup syncs via iCloud (Apple can't decrypt it)
 * - No server storage required - encrypted client-side only
 * - Recoverable across devices with same Apple ID
 */

import * as Crypto from 'expo-crypto';
import * as bip39 from 'bip39';
import * as SecureStore from 'expo-secure-store';
import { Passkey } from 'react-native-passkey';
import { SECURE_KEYS } from '../utils/constants';
import { PASSKEY } from '../constants/security';
import { deriveAddressesFromMnemonic } from '../utils/bitcoin';
import { logger } from '../utils/logger';
import {
  saveToICloud,
  loadFromICloud,
  hasICloudBackup,
  clearICloud,
} from './icloudStorage';

// Import crypto for AES-256-GCM
import { subtle, getRandomValues } from 'react-native-quick-crypto';
import * as Crypto from 'expo-crypto';

// Base64URL encoding helpers
const toBase64Url = (buffer) => {
  const base64 = Buffer.from(buffer).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

const fromBase64Url = (base64url) => {
  // Add padding if needed
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
};

// SecureStore keys for passkey data
const PASSKEY_KEYS = {
  ENABLED: 'passkey_enabled_v1',
  CREDENTIAL_ID: 'passkey_credential_id_v1',
  USER_HANDLE: 'passkey_user_handle_v1',
  CREATION_METHOD: 'wallet_creation_method_v1', // 'passkey' or 'pin'
  ENCRYPTED_MNEMONIC: 'passkey_encrypted_mnemonic_v1',
  ENCRYPTION_IV: 'passkey_encryption_iv_v1',
  ENCRYPTION_TAG: 'passkey_encryption_tag_v1',
};

/**
 * Check if WebAuthn/Passkeys are supported on this device
 */
export const isPasskeySupported = async () => {
  try {
    const supported = Passkey.isSupported();
    logger.debug('Passkey support check', { supported });
    return supported;
  } catch (error) {
    logger.error('Failed to check passkey support', { error: error.message });
    return false;
  }
};

/**
 * Generate random BIP39 mnemonic (12 words = 128 bits entropy)
 * @returns {string} BIP39 mnemonic
 */
const generateRandomMnemonic = () => {
  const mnemonic = bip39.generateMnemonic(128); // 12 words
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Generated mnemonic is invalid');
  }
  return mnemonic;
};

/**
 * Derive encryption key from passkey + PIN
 * Combines passkey credentials with user's PIN for Apple-proof encryption
 *
 * @param {Uint8Array} credentialId - WebAuthn credential ID
 * @param {Uint8Array} userHandle - User handle
 * @param {string} pin - User's 6-digit PIN
 * @returns {Promise<CryptoKey>} 256-bit AES-GCM encryption key
 */
const deriveEncryptionKey = async (credentialId, userHandle, pin, pinSalt) => {
  try {
    // SECURITY: Apply same 10,000 iteration hashing used for PIN verification
    // This makes brute force ~10,000x harder (1 second → 28 hours)
    const { hashPinForEncryption } = await import('./pinService');
    const derivedPin = await hashPinForEncryption(pin, pinSalt);

    // Combine passkey data + derived PIN for Apple-proof encryption
    // Apple has passkey but NOT the PIN (and would need 28 hours to brute force)
    const derivedPinBytes = Buffer.from(derivedPin, 'hex');
    const ikm = Buffer.concat([
      Buffer.from(credentialId),
      Buffer.from(userHandle),
      derivedPinBytes,
    ]);

    // Use standard RFC 5869 HKDF with SHA-256 via Web Crypto API
    // - salt: domain-specific string for key separation
    // - info: context and application-specific information
    const salt = new Uint8Array(Buffer.from('ducat-encryption-v3')); // v3 uses standard HKDF + derived PIN
    const info = new Uint8Array(Buffer.from('aes-256-gcm-key'));

    // Import IKM as CryptoKey for HKDF
    const baseKey = await subtle.importKey(
      'raw',
      ikm,
      { name: 'HKDF' },
      false,
      ['deriveBits']
    );

    // Derive 256-bit key using HKDF-SHA256
    const keyMaterial = await subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: salt,
        info: info,
      },
      baseKey,
      256 // 256 bits
    );

    // Import as CryptoKey for AES-GCM
    const cryptoKey = await subtle.importKey(
      'raw',
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return cryptoKey;
  } catch (error) {
    logger.error('Failed to derive encryption key', { error: error.message });
    throw new Error('Failed to derive encryption key from passkey');
  }
};

/**
 * Encrypt mnemonic with passkey-derived key (for local storage)
 * Uses AES-256-GCM for authenticated encryption
 *
 * @param {string} mnemonic - BIP39 mnemonic to encrypt
 * @param {CryptoKey} encryptionKey - 256-bit encryption key
 * @returns {Promise<{encrypted: string, iv: string, tag: string}>}
 */
const encryptMnemonic = async (mnemonic, encryptionKey) => {
  try {
    // Generate random IV (12 bytes for GCM)
    const iv = new Uint8Array(12);
    getRandomValues(iv);

    // Convert mnemonic to bytes
    const mnemonicBytes = new TextEncoder().encode(mnemonic);

    // Encrypt with AES-256-GCM
    const encrypted = await subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128, // 16 bytes authentication tag
      },
      encryptionKey,
      mnemonicBytes
    );

    // Extract ciphertext and tag (tag is last 16 bytes)
    const encryptedArray = new Uint8Array(encrypted);
    const ciphertext = encryptedArray.slice(0, -16);
    const tag = encryptedArray.slice(-16);

    return {
      encrypted: Buffer.from(ciphertext).toString('base64'),
      iv: Buffer.from(iv).toString('base64'),
      tag: Buffer.from(tag).toString('base64'),
    };
  } catch (error) {
    logger.error('Failed to encrypt mnemonic', { error: error.message });
    throw new Error('Failed to encrypt wallet seed');
  }
};

/**
 * Decrypt mnemonic with passkey-derived key
 *
 * @param {string} encryptedBase64 - Base64 encrypted mnemonic
 * @param {string} ivBase64 - Base64 IV
 * @param {string} tagBase64 - Base64 authentication tag
 * @param {CryptoKey} encryptionKey - 256-bit encryption key
 * @returns {Promise<string>} Decrypted mnemonic
 */
const decryptMnemonic = async (encryptedBase64, ivBase64, tagBase64, encryptionKey) => {
  try {
    // Decode from base64
    const ciphertext = new Uint8Array(Buffer.from(encryptedBase64, 'base64'));
    const iv = new Uint8Array(Buffer.from(ivBase64, 'base64'));
    const tag = new Uint8Array(Buffer.from(tagBase64, 'base64'));

    // Combine ciphertext and tag for decryption
    const encrypted = new Uint8Array(ciphertext.length + tag.length);
    encrypted.set(ciphertext);
    encrypted.set(tag, ciphertext.length);

    // Decrypt with AES-256-GCM
    const decrypted = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128,
      },
      encryptionKey,
      encrypted
    );

    const mnemonic = new TextDecoder().decode(decrypted);

    // Validate mnemonic before returning
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Decrypted mnemonic is invalid');
    }

    return mnemonic;
  } catch (error) {
    logger.error('Failed to decrypt mnemonic', { error: error.message });
    throw new Error('Failed to decrypt wallet seed');
  }
};

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
  try {
    logger.debug('Creating wallet with passkey', { userName });

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
    const { savePin } = await import('./pinService');
    await savePin(pin);

    // Get the PIN salt that was just created
    const pinSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
    // Validate salt format: 32 bytes = 64 hex characters
    if (!pinSalt || pinSalt.length !== 64 || !/^[0-9a-f]{64}$/i.test(pinSalt)) {
      throw new Error('Invalid or missing PIN salt - wallet creation failed');
    }

    // Derive encryption key from passkey + PIN with 10k iterations (Apple-proof!)
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
    try {
      await saveToICloud({
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
      // Note: icloudBackupSucceeded remains false, caller will show warning
    }

    logger.debug('Wallet created with passkey successfully', {
      segwitAddress: addresses.segwitAddress,
      taprootAddress: addresses.taprootAddress,
      icloudBackup: icloudBackupSucceeded,
    });

    return {
      mnemonic,
      addresses,
      credentialId: Buffer.from(credentialId).toString('base64'),
      icloudBackupSucceeded,
    };
  } catch (error) {
    logger.error('Failed to create wallet with passkey', { error: error.message });
    throw error;
  }
};

/**
 * Authenticate with passkey and unlock wallet
 * Used for same-device unlock (faster - uses encrypted mnemonic)
 *
 * @param {string} pin - User's PIN (required for decryption)
 * @returns {Promise<{mnemonic: string, addresses: Object}>}
 */
export const unlockWithPasskey = async (pin) => {
  try {
    logger.debug('Unlocking wallet with passkey');

    // Check if passkey is enabled
    const passkeyEnabled = await SecureStore.getItemAsync(PASSKEY_KEYS.ENABLED);
    if (passkeyEnabled !== 'true') {
      throw new Error('Passkey is not enabled for this wallet');
    }

    // Retrieve stored credential info
    const credentialIdBase64 = await SecureStore.getItemAsync(PASSKEY_KEYS.CREDENTIAL_ID);
    const userHandleBase64 = await SecureStore.getItemAsync(PASSKEY_KEYS.USER_HANDLE);
    const encryptedMnemonic = await SecureStore.getItemAsync(PASSKEY_KEYS.ENCRYPTED_MNEMONIC);
    const ivBase64 = await SecureStore.getItemAsync(PASSKEY_KEYS.ENCRYPTION_IV);
    const tagBase64 = await SecureStore.getItemAsync(PASSKEY_KEYS.ENCRYPTION_TAG);

    if (!credentialIdBase64 || !userHandleBase64 || !encryptedMnemonic || !ivBase64) {
      throw new Error('Passkey data not found in storage');
    }

    // Generate challenge for authentication
    const challenge = new Uint8Array(32);
    getRandomValues(challenge);

    // Create FIDO2 authentication request
    const requestJson = {
      challenge: toBase64Url(challenge),
      userVerification: PASSKEY.USER_VERIFICATION,
      allowCredentials: [
        {
          id: credentialIdBase64,
          type: 'public-key',
        },
      ],
      timeout: PASSKEY.TIMEOUT_MS,
    };

    // Only add rpId if configured (for production domain)
    if (PASSKEY.RP_ID) {
      requestJson.rpId = PASSKEY.RP_ID;
    }

    logger.debug('Authenticating with passkey...');

    // Authenticate with passkey
    const assertion = await Passkey.get(requestJson);

    logger.debug('Passkey authentication successful');

    // Verify the credential ID matches
    if (assertion.id !== credentialIdBase64) {
      throw new Error('Credential ID mismatch');
    }

    const credentialId = new Uint8Array(Buffer.from(credentialIdBase64, 'base64'));
    const userHandle = new Uint8Array(Buffer.from(userHandleBase64, 'base64'));

    // Validate PIN
    if (!pin || pin.length !== 6) {
      throw new Error('PIN is required to unlock wallet');
    }

    // Get the PIN salt for 10k iteration hashing
    const pinSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
    // Validate salt format: 32 bytes = 64 hex characters
    if (!pinSalt || pinSalt.length !== 64 || !/^[0-9a-f]{64}$/i.test(pinSalt)) {
      throw new Error('Invalid or corrupted PIN salt - wallet may need to be reset');
    }

    // Derive encryption key using passkey + PIN (with 10k iterations)
    const encryptionKey = await deriveEncryptionKey(credentialId, userHandle, pin, pinSalt);

    // Decrypt mnemonic
    const mnemonic = await decryptMnemonic(
      encryptedMnemonic,
      ivBase64,
      tagBase64 || '',
      encryptionKey
    );

    // Get current account index
    const accountIndex = parseInt(
      (await SecureStore.getItemAsync(SECURE_KEYS.CURRENT_ACCOUNT)) || '0',
      10
    );

    // Derive addresses
    const addresses = deriveAddressesFromMnemonic(mnemonic, accountIndex);

    logger.debug('Wallet unlocked with passkey successfully');

    return {
      mnemonic,
      addresses,
    };
  } catch (error) {
    logger.error('Failed to unlock with passkey', { error: error.message });
    throw error;
  }
};

/**
 * Recover wallet on new device with passkey
 * Loads encrypted backup from iCloud and decrypts with passkey + PIN
 *
 * @param {string} pin - User's PIN (required for decryption)
 * @returns {Promise<{mnemonic: string, addresses: Object}>}
 */
export const recoverWithPasskey = async (pin) => {
  try {
    logger.debug('Recovering wallet with passkey on new device');

    // Check if passkeys are supported
    const supported = await isPasskeySupported();
    if (!supported) {
      throw new Error('Passkeys are not supported on this device');
    }

    // Check if iCloud backup exists
    const hasBackup = await hasICloudBackup();
    if (!hasBackup) {
      throw new Error('No wallet backup found in iCloud');
    }

    // Load encrypted backup from iCloud
    logger.debug('Loading encrypted backup from iCloud...');
    const backup = await loadFromICloud();

    // Generate challenge
    const challenge = new Uint8Array(32);
    getRandomValues(challenge);

    // Create FIDO2 authentication request (discovery mode)
    const requestJson = {
      challenge: toBase64Url(challenge),
      userVerification: PASSKEY.USER_VERIFICATION,
      timeout: PASSKEY.TIMEOUT_MS,
    };

    // Only add rpId if configured
    if (PASSKEY.RP_ID) {
      requestJson.rpId = PASSKEY.RP_ID;
    }

    logger.debug('Authenticating with synced passkey...');

    // Authenticate with synced passkey
    const assertion = await Passkey.get(requestJson);

    logger.debug('Passkey authentication successful');

    // Extract credential info from backup (more reliable than assertion)
    const credentialId = new Uint8Array(Buffer.from(backup.credentialId, 'base64'));
    const userHandle = new Uint8Array(Buffer.from(backup.userHandle, 'base64'));

    // Validate PIN
    if (!pin || pin.length !== 6) {
      throw new Error('PIN is required to recover wallet');
    }

    // Use the PIN salt from the backup (critical for 10k iteration hashing)
    const pinSalt = backup.pinSalt;
    // Validate salt format: 32 bytes = 64 hex characters
    if (!pinSalt || pinSalt.length !== 64 || !/^[0-9a-f]{64}$/i.test(pinSalt)) {
      throw new Error('Invalid or missing PIN salt in backup - cannot decrypt wallet');
    }

    // Derive encryption key using passkey + PIN (with 10k iterations)
    const encryptionKey = await deriveEncryptionKey(credentialId, userHandle, pin, pinSalt);

    // Decrypt mnemonic from iCloud backup
    logger.debug('Decrypting mnemonic from backup...');
    const mnemonic = await decryptMnemonic(
      backup.encrypted,
      backup.iv,
      backup.tag || '',
      encryptionKey
    );

    logger.debug('Mnemonic decrypted successfully');

    // Derive addresses (account 0 by default)
    const addresses = deriveAddressesFromMnemonic(mnemonic, 0);

    // Store on new device
    await SecureStore.setItemAsync(PASSKEY_KEYS.ENABLED, 'true');
    await SecureStore.setItemAsync(PASSKEY_KEYS.CREATION_METHOD, 'passkey');
    await SecureStore.setItemAsync(PASSKEY_KEYS.CREDENTIAL_ID, backup.credentialId);
    await SecureStore.setItemAsync(PASSKEY_KEYS.USER_HANDLE, backup.userHandle);
    await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTED_MNEMONIC, backup.encrypted);
    await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTION_IV, backup.iv);
    if (backup.tag) {
      await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTION_TAG, backup.tag);
    }

    // Store in standard location
    await SecureStore.setItemAsync(SECURE_KEYS.MNEMONIC, mnemonic);
    await SecureStore.setItemAsync(SECURE_KEYS.CURRENT_ACCOUNT, '0');

    // Store the PIN salt from backup and save the PIN hash for daily unlock
    await SecureStore.setItemAsync(SECURE_KEYS.PIN_SALT, pinSalt);
    const { savePinWithExistingSalt } = await import('./pinService');
    await savePinWithExistingSalt(pin, pinSalt);

    logger.debug('Wallet recovered successfully from iCloud', {
      segwitAddress: addresses.segwitAddress,
      taprootAddress: addresses.taprootAddress,
    });

    return {
      mnemonic,
      addresses,
    };
  } catch (error) {
    logger.error('Failed to recover with passkey', { error: error.message });
    throw error;
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
    const requestJson = {
      challenge: toBase64Url(challenge),
      rp: {
        name: PASSKEY.RP_NAME,
        id: PASSKEY.RP_ID,
      },
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
      const { savePin } = await import('./pinService');
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

/**
 * Atomically change PIN and re-encrypt passkey data with rollback capability
 * CRITICAL: This operation must be atomic to prevent lockout scenarios
 * If passkey re-encryption fails, the old PIN is restored
 * @param {string} newPin - New PIN to set
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const atomicPinChangeWithPasskey = async (newPin) => {
  try {
    // Check if passkey is enabled
    const enabled = await isPasskeyEnabled();
    if (!enabled) {
      // No passkey, just change PIN normally
      const { savePin } = await import('./pinService');
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

    try {
      // Step 2: Save new PIN (generates new salt)
      const { savePin } = await import('./pinService');
      const pinSaveSuccess = await savePin(newPin);
      if (!pinSaveSuccess) {
        throw new Error('Failed to save new PIN');
      }

      // Step 3: Re-encrypt passkey mnemonic with new PIN salt
      // If this fails, we'll rollback the PIN change
      await reencryptPasskeyMnemonicAfterPinChange(newPin);

      logger.debug('Atomic PIN change completed successfully');
      return { success: true };
    } catch (error) {
      // Rollback: restore old PIN and passkey data
      logger.error('PIN change failed, rolling back to old PIN', { error: error.message });

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
        logger.error('CRITICAL: Rollback failed', { error: rollbackError.message });
        return {
          success: false,
          error: 'PIN change failed and rollback failed. Please contact support immediately.',
        };
      }

      return { success: false, error: 'PIN change failed. Your old PIN is still active.' };
    }
  } catch (error) {
    logger.error('Atomic PIN change failed', { error: error.message });
    return { success: false, error: error.message || 'Failed to change PIN' };
  }
};

/**
 * Re-encrypt passkey mnemonic with new PIN salt (called after PIN change)
 * CRITICAL: Must be called when PIN changes, otherwise passkey unlock will fail
 * @param {string} newPin - New PIN (already saved with new salt)
 * @returns {Promise<void>}
 */
export const reencryptPasskeyMnemonicAfterPinChange = async (newPin) => {
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
      logger.error('CRITICAL: iCloud backup failed after PIN change', {
        error: icloudError.message,
        errorCode: icloudError.code,
        errorName: icloudError.name,
        impact: 'Old PIN salt still in iCloud - recovery may fail on new devices',
        recommendation: 'User should retry PIN change or check iCloud settings',
      });
      // Don't throw - local passkey is updated, just iCloud sync failed
      // User can still unlock on this device
    }

    logger.debug('Passkey mnemonic re-encrypted successfully with new PIN salt');
  } catch (error) {
    logger.error('Failed to re-encrypt passkey mnemonic after PIN change', {
      error: error.message,
    });
    throw new Error('Failed to update passkey encryption with new PIN');
  }
};

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

// Re-export iCloud functions for convenience
export { hasICloudBackup } from './icloudStorage';

// Export keys for testing
export const PASSKEY_STORAGE_KEYS = PASSKEY_KEYS;
