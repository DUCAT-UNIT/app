/**
 * Crypto Secrets - Secret and blinding factor generation
 */

import * as crypto from 'expo-crypto';
import { Buffer } from 'buffer';

/** secp256k1 curve order — scalars must be in range (0, N) */
const SECP256K1_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

/** Check that a 32-byte value is a valid secp256k1 scalar (non-zero, less than curve order) */
const isValidScalar = (bytes: Uint8Array): boolean => {
  const value = BigInt('0x' + Buffer.from(bytes).toString('hex'));
  return value > 0n && value < SECP256K1_ORDER;
};

/**
 * Generate random secret (32 bytes hex)
 * @returns Random hex string
 */
export const generateSecret = async (): Promise<string> => {
  const bytes = await crypto.getRandomBytesAsync(32);
  return Buffer.from(bytes).toString('hex');
};

/**
 * Generate blinding factor (random scalar valid on secp256k1 curve)
 * Rejects values that are zero or >= curve order
 * @returns Random hex string (valid private key)
 */
export const generateBlindingFactor = async (): Promise<string> => {
  const maxAttempts = 256;
  for (let i = 0; i < maxAttempts; i++) {
    const bytes = await crypto.getRandomBytesAsync(32);
    if (isValidScalar(bytes)) {
      return Buffer.from(bytes).toString('hex');
    }
  }
  throw new Error('Failed to generate valid blinding factor');
};
