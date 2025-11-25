/**
 * Crypto Secrets - Secret and blinding factor generation
 */

import * as crypto from 'expo-crypto';
import { Buffer } from 'buffer';

/**
 * Generate random secret (32 bytes hex)
 * @returns {Promise<string>} Random hex string
 */
export const generateSecret = async () => {
  const bytes = await crypto.getRandomBytesAsync(32);
  return Buffer.from(bytes).toString('hex');
};

/**
 * Generate blinding factor (random scalar/private key)
 * @returns {Promise<string>} Random hex string (valid private key)
 */
export const generateBlindingFactor = async () => {
  const bytes = await crypto.getRandomBytesAsync(32);
  return Buffer.from(bytes).toString('hex');
};
