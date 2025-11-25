/**
 * PIN Hashing Utilities
 * Handles secure PIN hashing with PBKDF2
 */

import * as Crypto from 'expo-crypto';
import { pbkdf2Sync } from 'react-native-quick-crypto';
import { CRYPTO } from '../constants/security';

/**
 * Manual constant-time comparison since timingSafeEqual isn't available
 * Prevents timing attacks by ensuring comparison takes same time regardless of where strings differ
 * @param {Buffer} a - First buffer
 * @param {Buffer} b - Second buffer
 * @returns {boolean} True if buffers are equal
 */
export const timingSafeEqual = (a, b) => {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
};

/**
 * Generate a cryptographically secure random salt
 * @returns {Promise<string>} Random salt in hex format
 */
export const generateSalt = async () => {
  const randomBytes = await Crypto.getRandomBytesAsync(CRYPTO.SALT_LENGTH_BYTES);
  return Array.from(randomBytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Hash a PIN using standard PBKDF2 with HMAC-SHA512
 * Uses 10,000 iterations as a balance between security and mobile performance
 * Combined with rate limiting (10 attempts, 30min lockout) this provides strong protection
 * @param {string} pin - PIN to hash
 * @param {string} salt - Unique salt for this user (hex string)
 * @returns {Promise<string>} Hashed PIN (hex string)
 */
export const hashPin = async (pin, salt) => {
  try {
    // Use standard PBKDF2 with HMAC-SHA512
    // - password: user's PIN
    // - salt: unique 32-byte salt (hex string converted to buffer)
    // - iterations: 10,000 (configured)
    // - keylen: 64 bytes (512 bits) to match SHA512 output
    // - digest: sha512
    const derivedKey = pbkdf2Sync(
      pin,
      Buffer.from(salt, 'hex'),
      CRYPTO.PIN_HASH_ITERATIONS,
      64, // 64 bytes = 512 bits
      'sha512'
    );
    return derivedKey.toString('hex');
  } catch (error) {
    throw new Error('PIN hashing failed: ' + error.message);
  }
};

/**
 * Verify two PIN hashes are equal using constant-time comparison
 * Prevents timing attacks
 * @param {string} storedHash - Stored hash (hex string)
 * @param {string} enteredHash - Entered hash (hex string)
 * @returns {boolean} True if hashes match
 */
export const verifyPinHash = (storedHash, enteredHash) => {
  try {
    const storedBuffer = Buffer.from(storedHash, 'hex');
    const enteredBuffer = Buffer.from(enteredHash, 'hex');
    // timingSafeEqual requires same length, so check length first (constant time)
    return storedBuffer.length === enteredBuffer.length &&
           storedBuffer.length > 0 &&
           timingSafeEqual(storedBuffer, enteredBuffer);
  } catch (error) {
    // If comparison fails (e.g., invalid hex), treat as invalid PIN
    return false;
  }
};
