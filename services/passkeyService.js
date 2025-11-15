/**
 * Passkey Service - WebAuthn-based wallet authentication and recovery
 *
 * This service provides deterministic wallet derivation from passkeys:
 * - Passkey Credential → HKDF → Entropy → BIP39 Mnemonic → Wallet
 * - Same passkey always derives the same wallet
 * - Compatible with iCloud Keychain (iOS) and Google Password Manager (Android)
 * - No server storage required - 100% local deterministic derivation
 */

import * as Crypto from 'expo-crypto';
import * as bip39 from 'bip39';
import * as SecureStore from 'expo-secure-store';
import { Passkey } from 'react-native-passkey';
import { SECURE_KEYS } from '../utils/constants';
import { PASSKEY } from '../constants/security';
import { deriveAddressesFromMnemonic } from '../utils/bitcoin';
import { logger } from '../utils/logger';

// Import crypto for AES-256-GCM
import { subtle, getRandomValues } from 'react-native-quick-crypto';

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
 * Generate deterministic entropy from passkey credential
 * Uses HKDF to derive 128 bits of entropy for a 12-word BIP39 mnemonic
 *
 * @param {Uint8Array} credentialId - WebAuthn credential ID (stable, unique)
 * @param {Uint8Array} userHandle - User handle from credential (random)
 * @returns {Promise<Uint8Array>} 128 bits of entropy
 */
const deriveEntropyFromPasskey = async (credentialId, userHandle) => {
  try {
    // Combine credential ID and user handle as input key material
    const ikm = new Uint8Array([...credentialId, ...userHandle]);

    // Use SHA-256 HMAC for HKDF (expo-crypto provides this)
    // HKDF-Extract: PRK = HMAC(salt, IKM)
    const salt = new TextEncoder().encode(PASSKEY.DERIVATION_SALT);
    const prk = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Buffer.from(ikm).toString('hex') + Buffer.from(salt).toString('hex')
    );

    // HKDF-Expand: OKM = HMAC(PRK, info || 0x01)
    const info = new TextEncoder().encode(PASSKEY.DERIVATION_INFO);
    const okm = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      prk + Buffer.from(info).toString('hex') + '01'
    );

    // Take first 128 bits (16 bytes) for 12-word mnemonic
    const entropy = Buffer.from(okm, 'hex').slice(0, 16);

    return new Uint8Array(entropy);
  } catch (error) {
    logger.error('Failed to derive entropy from passkey', { error: error.message });
    throw new Error('Failed to derive wallet seed from passkey');
  }
};

/**
 * Derive encryption key from passkey for local storage
 * Different from mnemonic derivation - uses device-specific info
 *
 * @param {Uint8Array} credentialId - WebAuthn credential ID
 * @param {Uint8Array} userHandle - User handle
 * @returns {Promise<CryptoKey>} 256-bit AES-GCM encryption key
 */
const deriveEncryptionKey = async (credentialId, userHandle) => {
  try {
    const ikm = new Uint8Array([...credentialId, ...userHandle]);

    // Different info string for encryption vs mnemonic derivation
    const salt = new TextEncoder().encode('ducat-encryption-v1');
    const info = new TextEncoder().encode('aes-256-gcm-key');

    // HKDF to derive 256-bit key
    const prk = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Buffer.from(ikm).toString('hex') + Buffer.from(salt).toString('hex')
    );

    const okm = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      prk + Buffer.from(info).toString('hex') + '01'
    );

    // Use full 256 bits for AES-256
    const keyMaterial = Buffer.from(okm, 'hex').slice(0, 32);

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
 * Generates passkey → derives mnemonic → creates wallet
 *
 * @param {Object} options - Configuration options
 * @param {string} options.userName - User identifier (email or username)
 * @param {string} options.userDisplayName - Display name for the user
 * @returns {Promise<{mnemonic: string, addresses: Object, credentialId: string}>}
 */
export const createWalletWithPasskey = async ({ userName, userDisplayName }) => {
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
    const requestJson = {
      challenge: Buffer.from(challenge).toString('base64url'),
      rp: {
        name: PASSKEY.RP_NAME,
        id: PASSKEY.RP_ID,
      },
      user: {
        id: Buffer.from(userId).toString('base64url'),
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
    const credentialId = new Uint8Array(Buffer.from(result.id, 'base64url'));
    const userHandle = result.response.userHandle
      ? new Uint8Array(Buffer.from(result.response.userHandle, 'base64url'))
      : userId; // Fallback to userId if userHandle not provided

    logger.debug('Deriving mnemonic from passkey...');

    // Derive entropy from passkey (deterministic)
    const entropy = await deriveEntropyFromPasskey(credentialId, userHandle);

    // Generate BIP39 mnemonic from entropy
    const mnemonic = bip39.entropyToMnemonic(Buffer.from(entropy));

    logger.debug('Mnemonic derived from passkey');

    // Validate mnemonic
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Generated mnemonic is invalid');
    }

    // Derive wallet addresses (account 0)
    const addresses = deriveAddressesFromMnemonic(mnemonic, 0);

    // Derive encryption key for local storage
    const encryptionKey = await deriveEncryptionKey(credentialId, userHandle);

    // Encrypt mnemonic for local storage
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

    logger.debug('Wallet created with passkey successfully', {
      segwitAddress: addresses.segwitAddress,
      taprootAddress: addresses.taprootAddress,
    });

    return {
      mnemonic,
      addresses,
      credentialId: Buffer.from(credentialId).toString('base64'),
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
 * @returns {Promise<{mnemonic: string, addresses: Object}>}
 */
export const unlockWithPasskey = async () => {
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
      challenge: Buffer.from(challenge).toString('base64url'),
      rpId: PASSKEY.RP_ID,
      userVerification: PASSKEY.USER_VERIFICATION,
      allowCredentials: [
        {
          id: credentialIdBase64,
          type: 'public-key',
        },
      ],
      timeout: PASSKEY.TIMEOUT_MS,
    };

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

    // Derive encryption key
    const encryptionKey = await deriveEncryptionKey(credentialId, userHandle);

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
 * Re-derives mnemonic deterministically from synced passkey
 *
 * @returns {Promise<{mnemonic: string, addresses: Object}>}
 */
export const recoverWithPasskey = async () => {
  try {
    logger.debug('Recovering wallet with passkey on new device');

    // Check if passkeys are supported
    const supported = await isPasskeySupported();
    if (!supported) {
      throw new Error('Passkeys are not supported on this device');
    }

    // Generate challenge
    const challenge = new Uint8Array(32);
    getRandomValues(challenge);

    // Create FIDO2 authentication request (discovery mode - no allowCredentials)
    const requestJson = {
      challenge: Buffer.from(challenge).toString('base64url'),
      rpId: PASSKEY.RP_ID,
      userVerification: PASSKEY.USER_VERIFICATION,
      // No allowCredentials - let platform show all available passkeys
      timeout: PASSKEY.TIMEOUT_MS,
    };

    logger.debug('Authenticating with synced passkey...');

    // Authenticate with synced passkey
    const assertion = await Passkey.get(requestJson);

    logger.debug('Passkey authentication successful', { credentialId: assertion.id });

    // Extract credential info
    const credentialId = new Uint8Array(Buffer.from(assertion.id, 'base64url'));
    const userHandle = assertion.response.userHandle
      ? new Uint8Array(Buffer.from(assertion.response.userHandle, 'base64url'))
      : new Uint8Array(16); // Fallback if not provided

    // Re-derive entropy (same process as creation)
    const entropy = await deriveEntropyFromPasskey(credentialId, userHandle);

    // Re-derive mnemonic (deterministic - same as original)
    const mnemonic = bip39.entropyToMnemonic(Buffer.from(entropy));

    // Validate
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Recovered mnemonic is invalid');
    }

    // Derive addresses (account 0 by default)
    const addresses = deriveAddressesFromMnemonic(mnemonic, 0);

    // Store on new device
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

    // Encrypt and store mnemonic locally
    const encryptionKey = await deriveEncryptionKey(credentialId, userHandle);
    const { encrypted, iv, tag } = await encryptMnemonic(mnemonic, encryptionKey);
    await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTED_MNEMONIC, encrypted);
    await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTION_IV, iv);
    await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTION_TAG, tag);

    // Store in standard location
    await SecureStore.setItemAsync(SECURE_KEYS.MNEMONIC, mnemonic);
    await SecureStore.setItemAsync(SECURE_KEYS.CURRENT_ACCOUNT, '0');

    logger.debug('Wallet recovered successfully', {
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
 * Encrypts existing mnemonic with passkey for future unlocks
 *
 * @param {string} mnemonic - Existing wallet mnemonic
 * @param {string} userName - User identifier
 * @param {string} userDisplayName - Display name
 * @returns {Promise<{credentialId: string}>}
 */
export const addPasskeyToExistingWallet = async (mnemonic, userName, userDisplayName) => {
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
      challenge: Buffer.from(challenge).toString('base64url'),
      rp: {
        name: PASSKEY.RP_NAME,
        id: PASSKEY.RP_ID,
      },
      user: {
        id: Buffer.from(userId).toString('base64url'),
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

    const credentialId = new Uint8Array(Buffer.from(result.id, 'base64url'));
    const userHandle = result.response.userHandle
      ? new Uint8Array(Buffer.from(result.response.userHandle, 'base64url'))
      : userId;

    // Derive encryption key
    const encryptionKey = await deriveEncryptionKey(credentialId, userHandle);

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
 * Clear all passkey data (for wallet deletion)
 * @returns {Promise<void>}
 */
export const clearPasskeyData = async () => {
  try {
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.ENABLED);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.CREATION_METHOD);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.CREDENTIAL_ID);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.USER_HANDLE);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.ENCRYPTED_MNEMONIC);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.ENCRYPTION_IV);
    await SecureStore.deleteItemAsync(PASSKEY_KEYS.ENCRYPTION_TAG);

    logger.debug('All passkey data cleared');
  } catch (error) {
    logger.error('Failed to clear passkey data', { error: error.message });
  }
};

// Export keys for testing
export const PASSKEY_STORAGE_KEYS = PASSKEY_KEYS;
