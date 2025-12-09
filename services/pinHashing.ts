/**
 * PIN Hashing Utilities
 * Handles secure PIN hashing with PBKDF2
 */

import * as Crypto from 'expo-crypto';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pbkdf2Sync } = require('react-native-quick-crypto');
import { CRYPTO } from '../constants/security';

/**
 * Manual constant-time comparison since timingSafeEqual isn't available
 * Prevents timing attacks by ensuring comparison takes same time regardless of where strings differ
 * @param a - First buffer
 * @param b - Second buffer
 * @returns True if buffers are equal
 */
export const timingSafeEqual = (a: Buffer, b: Buffer): boolean => {
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
 * @returns Random salt in hex format
 */
export const generateSalt = async (): Promise<string> => {
  const randomBytes = await Crypto.getRandomBytesAsync(CRYPTO.SALT_LENGTH_BYTES);
  return Array.from(randomBytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Hash a PIN using standard PBKDF2 with HMAC-SHA512
 * Uses 310,000 iterations per OWASP recommendation (updated from 10,000)
 * Combined with rate limiting (10 attempts, 30min lockout) this provides strong protection
 * @param pin - PIN to hash
 * @param salt - Unique salt for this user (hex string)
 * @param iterations - Optional iteration count (defaults to current standard: 310,000)
 * @returns Hashed PIN (hex string)
 */
export const hashPin = async (pin: string, salt: string, iterations?: number): Promise<string> => {
  try {
    const iterationCount = iterations ?? CRYPTO.PIN_HASH_ITERATIONS;

    // Use standard PBKDF2 with HMAC-SHA512
    // - password: user's PIN
    // - salt: unique 32-byte salt (hex string converted to buffer)
    // - iterations: 310,000 (OWASP standard) or 10,000 (legacy)
    // - keylen: 64 bytes (512 bits) to match SHA512 output
    // - digest: sha512
    const derivedKey = pbkdf2Sync(
      pin,
      Buffer.from(salt, 'hex'),
      iterationCount,
      64, // 64 bytes = 512 bits
      'sha512'
    );
    return derivedKey.toString('hex');
  } catch (error: unknown) {
    throw new Error('PIN hashing failed: ' + (error as Error).message);
  }
};

/**
 * Verify two PIN hashes are equal using constant-time comparison
 * Prevents timing attacks
 * @param storedHash - Stored hash (hex string)
 * @param enteredHash - Entered hash (hex string)
 * @returns True if hashes match
 */
export const verifyPinHash = (storedHash: string, enteredHash: string): boolean => {
  try {
    const storedBuffer = Buffer.from(storedHash, 'hex');
    const enteredBuffer = Buffer.from(enteredHash, 'hex');
    // timingSafeEqual requires same length, so check length first (constant time)
    return storedBuffer.length === enteredBuffer.length &&
           storedBuffer.length > 0 &&
           timingSafeEqual(storedBuffer, enteredBuffer);
  } catch (error: unknown) {
    // If comparison fails (e.g., invalid hex), treat as invalid PIN
    return false;
  }
};
