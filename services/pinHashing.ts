/**
 * PIN Hashing Utilities
 * Handles secure PIN hashing with PBKDF2
 */

import * as Crypto from 'expo-crypto';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pbkdf2Sync, createHmac } = require('react-native-quick-crypto');
import { CRYPTO } from '../constants/security';

/**
 * Constant-time buffer comparison to prevent timing attacks
 *
 * SECURITY: This implementation ensures comparison takes the same amount of time
 * regardless of where (or if) the buffers differ. This prevents attackers from
 * using timing measurements to deduce information about the stored value.
 *
 * Key security properties:
 * 1. Always iterates over the longer buffer length (no early exit on length mismatch)
 * 2. Uses XOR accumulation to avoid branch prediction leaks
 * 3. Length difference is detected without revealing which buffer is longer
 *
 * @param a - First buffer
 * @param b - Second buffer
 * @returns True if buffers are equal in both length and content
 */
export const timingSafeEqual = (a: Buffer, b: Buffer): boolean => {
  // Use the longer length to ensure we always do the same amount of work
  // This prevents timing leaks based on buffer length differences
  const maxLength = Math.max(a.length, b.length);

  // Track length mismatch separately - will be non-zero if lengths differ
  // Using XOR ensures this is computed in constant time
  let lengthMismatch = a.length ^ b.length;

  // Accumulate XOR differences across all bytes
  // Even if lengths differ, we iterate over maxLength to maintain constant time
  let result = 0;
  for (let i = 0; i < maxLength; i++) {
    // Use 0 as fallback for out-of-bounds access to avoid undefined behavior
    // The lengthMismatch flag ensures we still return false for different lengths
    const byteA = i < a.length ? a[i] : 0;
    const byteB = i < b.length ? b[i] : 0;
    result |= byteA ^ byteB;
  }

  // Both conditions must be true:
  // 1. No length mismatch (lengthMismatch === 0)
  // 2. No byte differences (result === 0)
  // Using bitwise OR to combine without short-circuit evaluation
  return (lengthMismatch | result) === 0;
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
 * Prevents timing attacks by delegating to timingSafeEqual which handles all cases
 * @param storedHash - Stored hash (hex string)
 * @param enteredHash - Entered hash (hex string)
 * @returns True if hashes match
 */
export const verifyPinHash = (storedHash: string, enteredHash: string): boolean => {
  try {
    // Handle empty/invalid inputs in constant time
    if (!storedHash || !enteredHash) {
      // Still do a dummy comparison to maintain constant time
      const dummy = Buffer.alloc(64);
      timingSafeEqual(dummy, dummy);
      return false;
    }

    const storedBuffer = Buffer.from(storedHash, 'hex');
    const enteredBuffer = Buffer.from(enteredHash, 'hex');

    // timingSafeEqual now handles length mismatches in constant time
    // No need for separate length check that could leak timing info
    return timingSafeEqual(storedBuffer, enteredBuffer);
  } catch (error: unknown) {
    // If comparison fails (e.g., invalid hex), treat as invalid PIN
    // Do a dummy comparison to maintain constant time even on error path
    try {
      const dummy = Buffer.alloc(64);
      timingSafeEqual(dummy, dummy);
    } catch {
      // Ignore errors in dummy comparison
    }
    return false;
  }
};

/**
 * Generate HMAC for salt integrity verification
 * Uses device-specific key derived from secure random bytes
 *
 * SECURITY NOTE: This provides integrity checking, not confidentiality.
 * - Prevents accidental corruption of salt
 * - Detects tampering with salt storage
 * - Does NOT prevent determined attacker with root access
 *
 * @param salt - Salt to generate HMAC for (hex string)
 * @param key - HMAC key (hex string) - should be stored separately from salt
 * @returns HMAC (hex string)
 */
export const generateSaltHmac = (salt: string, key: string): string => {
  try {
    const hmac = createHmac('sha256', Buffer.from(key, 'hex'));
    hmac.update(Buffer.from(salt, 'hex'));
    return hmac.digest('hex');
  } catch (error: unknown) {
    throw new Error('HMAC generation failed: ' + (error as Error).message);
  }
};

/**
 * Verify salt HMAC for integrity checking
 * Uses constant-time comparison to prevent timing attacks
 * @param salt - Salt to verify (hex string)
 * @param expectedHmac - Expected HMAC (hex string)
 * @param key - HMAC key (hex string)
 * @returns True if HMAC matches
 */
export const verifySaltHmac = (salt: string, expectedHmac: string, key: string): boolean => {
  try {
    const computedHmac = generateSaltHmac(salt, key);
    const expectedBuffer = Buffer.from(expectedHmac, 'hex');
    const computedBuffer = Buffer.from(computedHmac, 'hex');

    // timingSafeEqual now handles all cases including length mismatches
    // in constant time - no separate length check needed
    return timingSafeEqual(expectedBuffer, computedBuffer);
  } catch (error: unknown) {
    // If verification fails, do a dummy comparison to maintain constant time
    try {
      const dummy = Buffer.alloc(32);
      timingSafeEqual(dummy, dummy);
    } catch {
      // Ignore errors in dummy comparison
    }
    return false;
  }
};
