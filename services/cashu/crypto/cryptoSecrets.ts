/**
 * Crypto Secrets - Secret and blinding factor generation
 */

import * as crypto from 'expo-crypto';
import { Buffer } from 'buffer';

/**
 * Generate random secret (32 bytes hex)
 * @returns Random hex string
 */
export const generateSecret = async (): Promise<string> => {
  const bytes = await crypto.getRandomBytesAsync(32);
  return Buffer.from(bytes).toString('hex');
};

/**
 * Generate blinding factor (random scalar/private key)
 * @returns Random hex string (valid private key)
 */
export const generateBlindingFactor = async (): Promise<string> => {
  const bytes = await crypto.getRandomBytesAsync(32);
  return Buffer.from(bytes).toString('hex');
};
