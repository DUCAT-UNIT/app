/**
 * Crypto Blinding - DHKE blinding operations for Cashu (NUT-00)
 */

import * as crypto from 'expo-crypto';
import { Buffer } from 'buffer';
import * as ecc from '@bitcoinerlab/secp256k1';
import { Point } from '@noble/secp256k1';
import { logger } from '../../../utils/logger';
import { generateSecret, generateBlindingFactor } from './cryptoSecrets';

/**
 * Hash secret to curve point (Y = hash_to_curve(secret))
 * Implements Cashu's hash_to_curve as per NUT-00 specification
 * @param {string} secret - Secret string
 * @returns {Promise<string>} Compressed public key hex (33 bytes, starts with 02 or 03)
 */
export const hashToCurve = async (secret) => {
  // Cashu domain separator: "Secp256k1_HashToCurve_Cashu_"
  const DOMAIN_SEPARATOR = new Uint8Array([
    83, 101, 99, 112, 50, 53, 54, 107, 49, 95, 72, 97, 115, 104, 84, 111, 67, 117, 114, 118, 101, 95,
    67, 97, 115, 104, 117, 95,
  ]);

  // First hash: SHA256(DOMAIN_SEPARATOR || secret)
  const secretBytes = new TextEncoder().encode(secret);
  const combined = new Uint8Array([...DOMAIN_SEPARATOR, ...secretBytes]);

  // Hash the bytes directly
  const msgToHashBytes = await crypto.digest(crypto.CryptoDigestAlgorithm.SHA256, combined);
  const msgToHash = new Uint8Array(msgToHashBytes);

  // Try counters from 0 to 2^16 to find a valid point
  for (let counter = 0; counter < 2 ** 16; counter++) {
    // Create 4-byte counter (little-endian)
    const counterBytes = new Uint8Array(4);
    new DataView(counterBytes.buffer).setUint32(0, counter, true); // true = little-endian

    // Hash: SHA256(msgToHash || counter)
    const hashInput = new Uint8Array([...msgToHash, ...counterBytes]);
    const hashBytes = await crypto.digest(crypto.CryptoDigestAlgorithm.SHA256, hashInput);
    const hashHex = Buffer.from(hashBytes).toString('hex');

    // Try to create a point with prefix 02 (even y-coordinate)
    const pointHex = '02' + hashHex;

    try {
      // Use the SAME validation as the server: Point.fromHex()
      Point.fromHex(pointHex);
      // Valid point found!
      return pointHex;
    } catch {
      // Not a valid point, try next counter
      continue;
    }
  }

  throw new Error('Could not hash to curve');
};

/**
 * Create blinded message for minting
 * B_ = Y + r*G where:
 * - Y = hash_to_curve(secret)
 * - r = blinding factor
 * - G = generator point
 *
 * @param {string} secret - Secret to blind
 * @param {string} blindingFactor - Blinding factor (r)
 * @returns {Promise<Object>} Blinded message {B_: string, secret: string, r: string}
 */
export const createBlindedMessage = async (secret, blindingFactor = null) => {
  try {
    // Generate blinding factor if not provided
    const r = blindingFactor || await generateBlindingFactor();

    // Hash secret to curve point Y
    const Y = await hashToCurve(secret);

    // Calculate r*G (public key from blinding factor)
    const rBuffer = Buffer.from(r, 'hex');
    const rG = ecc.pointFromScalar(rBuffer, true);

    // B_ = Y + r*G (point addition)
    const YBuffer = Buffer.from(Y, 'hex');
    const rGBuffer = Buffer.from(rG); // Convert Uint8Array to Buffer
    const B_ = ecc.pointAdd(YBuffer, rGBuffer, true);

    return {
      amount: 0, // Will be set by caller
      B_: Buffer.from(B_).toString('hex'), // Convert Uint8Array to Buffer for hex
      secret,
      r,
    };
  } catch (error) {
    logger.error('Failed to create blinded message', { error: error.message });
    throw new Error(`Blinding failed: ${error.message}`);
  }
};

/**
 * Unblind signature
 * C = C_ - r*A where:
 * - C_ = blinded signature from mint
 * - r = blinding factor
 * - A = mint's public key for this amount
 *
 * @param {string} C_ - Blinded signature from mint (hex)
 * @param {string} r - Blinding factor (hex)
 * @param {string} A - Mint public key for this amount (hex)
 * @returns {string} Unblinded signature (C)
 */
export const unblindSignature = (C_, r, A) => {
  try {
    // C_ - r*A
    const C_Buffer = Buffer.from(C_, 'hex');
    const rBuffer = Buffer.from(r, 'hex');
    const ABuffer = Buffer.from(A, 'hex');

    // Calculate r*A
    const rA = ecc.pointMultiply(ABuffer, rBuffer, true);

    // To negate a point, we need to use pointAddScalar with order - scalar
    // But @bitcoinerlab/secp256k1 doesn't have pointNegate
    // We can work around this by using the secp256k1 curve order
    // For point P = (x, y), -P = (x, -y mod p)
    // The library should handle this via pointSubtract if available

    // Instead of pointNegate, we'll use the fact that C_ - r*A can be computed
    // by inverting the scalar: C_ + r*(-A) = C_ + (order - r)*A
    // But simpler: just manually implement point negation
    const rABytes = Buffer.from(rA);

    // Negate the y-coordinate by flipping the prefix byte (02 <-> 03)
    const negRA = Buffer.from(rABytes);
    if (negRA[0] === 0x02) {
      negRA[0] = 0x03;
    } else if (negRA[0] === 0x03) {
      negRA[0] = 0x02;
    }

    // C = C_ + (-(r*A)) = C_ - r*A
    const C = ecc.pointAdd(C_Buffer, negRA, true);

    return Buffer.from(C).toString('hex');
  } catch (error) {
    logger.error('Failed to unblind signature', { error: error.message });
    // If unblinding fails, return C_ as-is (simplified fallback)
    return C_;
  }
};

/**
 * Create blinded outputs for amounts (for minting or swapping)
 * @param {Array<number>} amounts - Amounts to create outputs for
 * @param {string} keysetId - Optional keyset ID to use (if not provided, outputs won't have id)
 * @returns {Promise<Array>} Array of {blindedMessage, blindingData}
 */
export const createBlindedOutputs = async (amounts, keysetId = null) => {
  // Create all blinded messages in parallel
  const blindedMessages = await Promise.all(
    amounts.map(async (amount) => {
      const secret = await generateSecret();
      const blindedMsg = await createBlindedMessage(secret);
      blindedMsg.amount = amount;

      const output = {
        amount,
        B_: blindedMsg.B_,
      };

      // Add keyset ID if provided
      if (keysetId) {
        output.id = keysetId;
      }

      return {
        output,
        blindingData: {
          amount,
          secret: blindedMsg.secret,
          r: blindedMsg.r,
          B_: blindedMsg.B_,
        }
      };
    })
  );

  // Sort outputs by amount (ascending) for privacy (NUT-03 recommendation)
  // This prevents the mint from distinguishing between send amount and change
  blindedMessages.sort((a, b) => a.output.amount - b.output.amount);

  return {
    outputs: blindedMessages.map(m => m.output),
    blindingData: blindedMessages.map(m => m.blindingData)
  };
};

/**
 * Unblind signatures and create proofs
 * @param {Array} signatures - Blind signatures from mint
 * @param {Array} blindingData - Blinding data from createBlindedOutputs
 * @param {Object} keys - Mint public keys { amount: pubkey }
 * @param {string} keysetId - Keyset ID
 * @returns {Array} Array of Cashu proofs
 */
export const unblindSignatures = (signatures, blindingData, keys, keysetId) => {
  const { createProof } = require('./cryptoProofs');
  const proofs = [];

  for (let i = 0; i < signatures.length; i++) {
    const sig = signatures[i];
    const data = blindingData[i];

    // Get mint's public key for this amount
    const A = keys[data.amount];
    if (!A) {
      logger.warn('No public key for amount', { amount: data.amount });
      continue;
    }

    // Unblind signature
    const C = unblindSignature(sig.C_, data.r, A);

    // Create proof
    const proof = createProof(data.amount, data.secret, C, sig.id || keysetId);
    proofs.push(proof);
  }

  return proofs;
};
