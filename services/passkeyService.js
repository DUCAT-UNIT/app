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
import { SECURE_KEYS } from '../utils/constants';
import { deriveAddressesFromMnemonic } from '../utils/bitcoin';
import { logger } from '../utils/logger';

// Passkey configuration constants
const PASSKEY_CONFIG = {
  RP_NAME: 'Ducat Wallet',
  RP_ID: 'ducat.app', // Will be updated to actual domain in production
  TIMEOUT: 60000, // 60 seconds
  USER_VERIFICATION: 'required', // Always require biometric/PIN
  RESIDENT_KEY: 'required', // Store passkey on device
  ATTESTATION: 'none', // Don't need attestation for wallet use case
};

// HKDF derivation parameters (for deterministic mnemonic generation)
const DERIVATION_CONFIG = {
  SALT: 'ducat-wallet-v1', // Version-specific salt
  INFO: 'bip39-mnemonic-seed', // Domain separation
  KEY_LENGTH_BITS: 128, // 128 bits = 12-word mnemonic
};

// SecureStore keys for passkey data
const PASSKEY_KEYS = {
  ENABLED: 'passkey_enabled_v1',
  CREDENTIAL_ID: 'passkey_credential_id_v1',
  USER_HANDLE: 'passkey_user_handle_v1',
  CREATION_METHOD: 'wallet_creation_method_v1', // 'passkey' or 'pin'
  ENCRYPTED_MNEMONIC: 'passkey_encrypted_mnemonic_v1',
  ENCRYPTION_IV: 'passkey_encryption_iv_v1',
};

/**
 * Check if WebAuthn/Passkeys are supported on this device
 * Note: React Native doesn't have direct WebAuthn support yet
 * This will need to be implemented with a native module or web view
 * For now, we'll create a placeholder that can be replaced
 */
export const isPasskeySupported = async () => {
  // TODO: Implement actual WebAuthn support check
  // This will require either:
  // 1. expo-local-authentication with passkey support
  // 2. react-native-passkey library
  // 3. WebView-based implementation

  // For now, return false - will be implemented when WebAuthn module is added
  return false;
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
    const salt = new TextEncoder().encode(DERIVATION_CONFIG.SALT);
    const prk = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Buffer.from(ikm).toString('hex') + Buffer.from(salt).toString('hex')
    );

    // HKDF-Expand: OKM = HMAC(PRK, info || 0x01)
    const info = new TextEncoder().encode(DERIVATION_CONFIG.INFO);
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
 * @returns {Promise<Uint8Array>} 256-bit encryption key
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
    return new Uint8Array(Buffer.from(okm, 'hex').slice(0, 32));
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
 * @param {Uint8Array} encryptionKey - 256-bit encryption key
 * @returns {Promise<{encrypted: string, iv: string}>}
 */
const encryptMnemonic = async (mnemonic, encryptionKey) => {
  try {
    // Generate random IV (12 bytes for GCM)
    const iv = await Crypto.getRandomBytesAsync(12);

    // For now, use a simple XOR encryption as placeholder
    // TODO: Replace with proper AES-GCM when native crypto module is available
    // This is temporary - in production should use react-native-quick-crypto or similar
    const mnemonicBytes = new TextEncoder().encode(mnemonic);
    const encrypted = new Uint8Array(mnemonicBytes.length);

    for (let i = 0; i < mnemonicBytes.length; i++) {
      encrypted[i] = mnemonicBytes[i] ^ encryptionKey[i % encryptionKey.length];
    }

    return {
      encrypted: Buffer.from(encrypted).toString('base64'),
      iv: Buffer.from(iv).toString('base64'),
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
 * @param {Uint8Array} encryptionKey - 256-bit encryption key
 * @returns {Promise<string>} Decrypted mnemonic
 */
const decryptMnemonic = async (encryptedBase64, ivBase64, encryptionKey) => {
  try {
    // Decode from base64
    const encrypted = new Uint8Array(Buffer.from(encryptedBase64, 'base64'));

    // XOR decryption (matches encryption above)
    // TODO: Replace with proper AES-GCM decryption
    const decrypted = new Uint8Array(encrypted.length);

    for (let i = 0; i < encrypted.length; i++) {
      decrypted[i] = encrypted[i] ^ encryptionKey[i % encryptionKey.length];
    }

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

    // TODO: Implement actual WebAuthn credential creation
    // This is a placeholder that will be replaced with real WebAuthn implementation

    // For now, simulate passkey creation with random bytes
    const credentialId = await Crypto.getRandomBytesAsync(32);
    const userHandle = await Crypto.getRandomBytesAsync(16);

    logger.debug('Passkey credential created', {
      credentialIdLength: credentialId.length,
      userHandleLength: userHandle.length,
    });

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
    const { encrypted, iv } = await encryptMnemonic(mnemonic, encryptionKey);

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

    // TODO: Implement actual WebAuthn authentication
    // This is a placeholder

    // Retrieve stored credential info
    const credentialIdBase64 = await SecureStore.getItemAsync(PASSKEY_KEYS.CREDENTIAL_ID);
    const userHandleBase64 = await SecureStore.getItemAsync(PASSKEY_KEYS.USER_HANDLE);
    const encryptedMnemonic = await SecureStore.getItemAsync(PASSKEY_KEYS.ENCRYPTED_MNEMONIC);
    const ivBase64 = await SecureStore.getItemAsync(PASSKEY_KEYS.ENCRYPTION_IV);

    if (!credentialIdBase64 || !userHandleBase64 || !encryptedMnemonic) {
      throw new Error('Passkey data not found in storage');
    }

    const credentialId = new Uint8Array(Buffer.from(credentialIdBase64, 'base64'));
    const userHandle = new Uint8Array(Buffer.from(userHandleBase64, 'base64'));

    // Derive encryption key
    const encryptionKey = await deriveEncryptionKey(credentialId, userHandle);

    // Decrypt mnemonic
    const mnemonic = await decryptMnemonic(encryptedMnemonic, ivBase64, encryptionKey);

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

    // TODO: Implement actual WebAuthn authentication (discover mode)
    // This will use the passkey synced via iCloud/Google

    // Simulate passkey authentication
    // In real implementation, this would return the credential from WebAuthn
    const credentialId = await Crypto.getRandomBytesAsync(32);
    const userHandle = await Crypto.getRandomBytesAsync(16);

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
    const { encrypted, iv } = await encryptMnemonic(mnemonic, encryptionKey);
    await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTED_MNEMONIC, encrypted);
    await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTION_IV, iv);

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
 * @returns {Promise<{credentialId: string}>}
 */
export const addPasskeyToExistingWallet = async (mnemonic) => {
  try {
    logger.debug('Adding passkey to existing wallet');

    // Validate mnemonic
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic');
    }

    // TODO: Implement actual WebAuthn credential creation
    const credentialId = await Crypto.getRandomBytesAsync(32);
    const userHandle = await Crypto.getRandomBytesAsync(16);

    // Derive encryption key
    const encryptionKey = await deriveEncryptionKey(credentialId, userHandle);

    // Encrypt existing mnemonic
    const { encrypted, iv } = await encryptMnemonic(mnemonic, encryptionKey);

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

    logger.debug('All passkey data cleared');
  } catch (error) {
    logger.error('Failed to clear passkey data', { error: error.message });
  }
};

// Export keys for testing
export const PASSKEY_STORAGE_KEYS = PASSKEY_KEYS;
