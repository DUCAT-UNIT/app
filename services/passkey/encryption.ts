/**
 * Mnemonic Encryption - AES-256-GCM encryption/decryption for seed phrase protection
 */

import * as bip39 from 'bip39';
import * as SecureStore from 'expo-secure-store';
import type { AesGcmKey,EncryptedMnemonicData } from '../../types/crypto';
import { SECURE_KEYS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { hashPinForEncryption } from '../pinService';
const { subtle, getRandomValues, createHmac } = require('react-native-quick-crypto');

/**
 * Generate random BIP39 mnemonic (12 words = 128 bits entropy)
 * Uses react-native-quick-crypto CSPRNG for entropy generation instead of
 * bip39's default Math.random()-based fallback.
 * @returns BIP39 mnemonic
 */
export const generateRandomMnemonic = (): string => {
  const entropy = new Uint8Array(16); // 128 bits
  getRandomValues(entropy);
  const mnemonic = bip39.entropyToMnemonic(Buffer.from(entropy).toString('hex'));
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Generated mnemonic is invalid');
  }
  return mnemonic;
};

/**
 * Derive encryption key via HKDF (RFC 5869) from credential identifiers, PIN, and device pepper.
 *
 * When `prfSecret` is provided (PRF-enabled passkeys), the IKM becomes:
 *   prfSecret (32-byte HMAC output from authenticator)
 *   + PBKDF2-stretched PIN (310k iterations)
 *   + device-bound pepper (128-bit)
 * and the HKDF salt is bumped to 'ducat-encryption-v5' to prevent key collision.
 *
 * When `prfSecret` is null (legacy / non-PRF passkeys), the IKM is:
 *   credentialId + userHandle (static identifiers, not secrets)
 *   + PBKDF2-stretched PIN (310k iterations -- the primary secret)
 *   + device-bound pepper (128-bit, stored in SecureStore)
 * with HKDF salt 'ducat-encryption-v4'.
 *
 * @param credentialId - WebAuthn credential ID (identifier, not a secret)
 * @param userHandle - User handle (identifier, not a secret)
 * @param pinOrHash - User's 6-digit PIN or pre-hashed PIN (if isPreHashed=true)
 * @param pinSalt - PIN salt
 * @param isPreHashed - If true, pinOrHash is already PBKDF2-hashed (performance optimization)
 * @param prfSecret - PRF extension output from authenticator, or null for legacy derivation
 * @returns 256-bit AES-GCM encryption key
 */
export const deriveEncryptionKey = async (
  credentialId: Uint8Array,
  userHandle: Uint8Array,
  pinOrHash: string,
  pinSalt: string,
  isPreHashed = false,
  prfSecret: Uint8Array | null = null
): Promise<AesGcmKey> => {
  try {
    // Device-bound pepper to raise brute force cost beyond 6-digit PIN space
    let pepper = await SecureStore.getItemAsync(SECURE_KEYS.PASSKEY_PEPPER);
    if (!pepper) {
      const bytes = new Uint8Array(16); // 128-bit pepper
      getRandomValues(bytes);
      pepper = Buffer.from(bytes).toString('hex');
      await SecureStore.setItemAsync(SECURE_KEYS.PASSKEY_PEPPER, pepper, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    }

    // SECURITY: Apply same 310,000 iteration PBKDF2 hashing used for PIN verification
    // This makes brute force ~310,000x harder per attempt
    let derivedPin: string;
    if (isPreHashed) {
      // Performance optimization: Use pre-computed hash (saves ~500ms)
      derivedPin = pinOrHash;
    } else {
      // Standard path: Hash the PIN
      derivedPin = await hashPinForEncryption(pinOrHash, pinSalt);
    }

    const derivedPinBytes = Buffer.from(derivedPin, 'hex');
    const pepperBytes = Buffer.from(pepper, 'hex');

    let ikm: Buffer;
    let hkdfSaltStr: string;

    if (prfSecret) {
      // PRF path: authenticator-derived secret replaces static credential identifiers.
      // prfSecret = HMAC-SHA-256(passkey_private_key, PRF_SALT) -- deterministic,
      // syncs cross-device via iCloud Keychain, and is a real cryptographic secret.
      ikm = Buffer.concat([
        Buffer.from(prfSecret),
        derivedPinBytes,
        pepperBytes,
      ]);
      // Bump HKDF salt to v5 to prevent key collision between PRF and non-PRF derivations
      hkdfSaltStr = 'ducat-encryption-v5';
    } else {
      // Legacy path: credential IDs + PIN + pepper (backwards compatible).
      ikm = Buffer.concat([
        Buffer.from(credentialId),
        Buffer.from(userHandle),
        derivedPinBytes,
        pepperBytes,
      ]);
      hkdfSaltStr = 'ducat-encryption-v4';
    }

    // RFC 5869 compliant HKDF with SHA-256
    const salt = Buffer.from(hkdfSaltStr, 'utf8');
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
  } catch (error: unknown) {
    logger.error('Failed to derive encryption key', { error: (error as Error).message });
    throw new Error('Failed to derive encryption key from passkey');
  }
};

/**
 * Encrypt mnemonic with passkey-derived key (for local storage)
 * Uses AES-256-GCM for authenticated encryption
 *
 * @param mnemonic - BIP39 mnemonic to encrypt
 * @param encryptionKey - 256-bit encryption key
 * @returns Encrypted mnemonic with IV and tag
 */
export const encryptMnemonic = async (
  mnemonic: string,
  encryptionKey: AesGcmKey
): Promise<EncryptedMnemonicData> => {
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
  } catch (error: unknown) {
    logger.error('Failed to encrypt mnemonic', { error: (error as Error).message });
    throw new Error('Failed to encrypt wallet seed');
  }
};

/**
 * Decrypt mnemonic with passkey-derived key
 *
 * @param encryptedBase64 - Base64 encrypted mnemonic
 * @param ivBase64 - Base64 IV
 * @param tagBase64 - Base64 authentication tag
 * @param encryptionKey - 256-bit encryption key
 * @returns Decrypted mnemonic
 */
export const decryptMnemonic = async (
  encryptedBase64: string,
  ivBase64: string,
  tagBase64: string,
  encryptionKey: AesGcmKey
): Promise<string> => {
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
  } catch (error: unknown) {
    logger.error('Failed to decrypt mnemonic', { error: (error as Error).message });
    throw new Error('Failed to decrypt wallet seed');
  }
};
