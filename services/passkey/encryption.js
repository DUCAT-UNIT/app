/**
 * Passkey Encryption - Cryptographic operations for mnemonic protection
 */

import * as bip39 from 'bip39';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { subtle, getRandomValues, createHmac } from 'react-native-quick-crypto';

/**
 * Generate random BIP39 mnemonic (12 words = 128 bits entropy)
 * @returns {string} BIP39 mnemonic
 */
export const generateRandomMnemonic = () => {
  const mnemonic = bip39.generateMnemonic(128); // 12 words
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Generated mnemonic is invalid');
  }
  return mnemonic;
};

/**
 * Derive encryption key from passkey + PIN using RFC 5869 compliant HKDF
 * Combines passkey credentials with user's PIN for Apple-proof encryption
 *
 * @param {Uint8Array} credentialId - WebAuthn credential ID
 * @param {Uint8Array} userHandle - User handle
 * @param {string} pinOrHash - User's 6-digit PIN or pre-hashed PIN (if isPreHashed=true)
 * @param {string} pinSalt - PIN salt
 * @param {boolean} isPreHashed - If true, pinOrHash is already PBKDF2-hashed (performance optimization)
 * @returns {Promise<CryptoKey>} 256-bit AES-GCM encryption key
 */
export const deriveEncryptionKey = async (credentialId, userHandle, pinOrHash, pinSalt, isPreHashed = false) => {
  try {
    // SECURITY: Apply same 10,000 iteration hashing used for PIN verification
    // This makes brute force ~10,000x harder (1 second → 28 hours)
    let derivedPin;
    if (isPreHashed) {
      // Performance optimization: Use pre-computed hash (saves ~500ms)
      derivedPin = pinOrHash;
    } else {
      // Standard path: Hash the PIN
      const { hashPinForEncryption } = await import('../pinService');
      derivedPin = await hashPinForEncryption(pinOrHash, pinSalt);
    }

    // Combine passkey data + derived PIN for Apple-proof encryption
    // Apple has passkey but NOT the PIN (and would need 28 hours to brute force)
    const derivedPinBytes = Buffer.from(derivedPin, 'hex');
    const ikm = Buffer.concat([
      Buffer.from(credentialId),
      Buffer.from(userHandle),
      derivedPinBytes,
    ]);

    // RFC 5869 compliant HKDF with SHA-256
    const salt = Buffer.from('ducat-encryption-v4', 'utf8');
    const info = Buffer.from('aes-256-gcm-key', 'utf8');

    // HKDF-Extract: PRK = HMAC-SHA256(salt, IKM)
    // Uses proper HMAC instead of simple hash concatenation
    const prkHmac = createHmac('sha256', salt);
    const prk = prkHmac.update(ikm).digest();

    // HKDF-Expand: OKM = HMAC-SHA256(PRK, info || 0x01)
    // Produces exactly 32 bytes for AES-256
    const okmHmac = createHmac('sha256', prk);
    const okm = okmHmac.update(Buffer.concat([info, Buffer.from([0x01])])).digest();

    // Use OKM directly as key material (already a Buffer)
    const keyMaterial = okm;

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
export const encryptMnemonic = async (mnemonic, encryptionKey) => {
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
export const decryptMnemonic = async (encryptedBase64, ivBase64, tagBase64, encryptionKey) => {
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
