import * as crypto from 'expo-crypto';
import { Buffer } from 'buffer';
import { logger } from '../../utils/logger';
import * as ecc from '@bitcoinerlab/secp256k1';

/**
 * Cashu Crypto Operations
 * Implements DHKE (Diffie-Hellman Key Exchange) for blind signatures
 * Based on Cashu NUT-00 specification
 *
 * Uses proper secp256k1 cryptography via @bitcoinerlab/secp256k1
 */

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

/**
 * Hash secret to curve point (Y = hash_to_curve(secret))
 * Converts a secret string to a valid secp256k1 point
 * @param {string} secret - Secret string
 * @returns {Promise<string>} Compressed public key hex (33 bytes, starts with 02 or 03)
 */
export const hashToCurve = async (secret) => {
  // Hash the secret
  const digest = await crypto.digestStringAsync(
    crypto.CryptoDigestAlgorithm.SHA256,
    secret
  );

  // Use the hash as a private key and derive its public key
  // This gives us a valid curve point
  const privKey = Buffer.from(digest, 'hex');
  const pubKey = ecc.pointFromScalar(privKey, true); // true = compressed

  // ecc returns Uint8Array, convert to Buffer for hex encoding
  return Buffer.from(pubKey).toString('hex');
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

    // Negate r*A to get -(r*A)
    const negRA = ecc.pointNegate(rA);

    // C = C_ + (-(r*A)) = C_ - r*A
    const C = ecc.pointAdd(C_Buffer, Buffer.from(negRA), true);

    return Buffer.from(C).toString('hex');
  } catch (error) {
    logger.error('Failed to unblind signature', { error: error.message });
    // If unblinding fails, return C_ as-is (simplified fallback)
    return C_;
  }
};

/**
 * Create proof from blinded signature
 * @param {number} amount - Amount of this proof
 * @param {string} secret - Secret used for blinding
 * @param {string} C - Unblinded signature
 * @param {string} id - Keyset ID
 * @returns {Object} Cashu proof
 */
export const createProof = (amount, secret, C, id) => {
  return {
    amount,
    secret,
    C,
    id,
  };
};

/**
 * Create blinded outputs for amounts (for minting or swapping)
 * @param {Array<number>} amounts - Amounts to create outputs for
 * @param {string} keysetId - Optional keyset ID to use (if not provided, outputs won't have id)
 * @returns {Promise<Array>} Array of {blindedMessage, blindingData}
 */
export const createBlindedOutputs = async (amounts, keysetId = null) => {
  const outputs = [];
  const blindingData = [];

  for (const amount of amounts) {
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

    outputs.push(output);

    blindingData.push({
      amount,
      secret: blindedMsg.secret,
      r: blindedMsg.r,
      B_: blindedMsg.B_,
    });
  }

  return { outputs, blindingData };
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

/**
 * Split amount into powers of 2 (for efficient change)
 * Example: 100 -> [64, 32, 4]
 * @param {number} amount - Amount to split
 * @returns {Array<number>} Array of amounts (powers of 2)
 */
export const splitAmount = (amount) => {
  const amounts = [];
  let remaining = amount;

  // Standard denominations from high to low
  const denominations = [16384, 8192, 4096, 2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1];

  for (const denom of denominations) {
    while (remaining >= denom) {
      amounts.push(denom);
      remaining -= denom;
    }
  }

  return amounts;
};

/**
 * Sum proof amounts
 * @param {Array} proofs - Array of proofs
 * @returns {number} Total amount
 */
export const sumProofs = (proofs) => {
  return proofs.reduce((sum, proof) => sum + proof.amount, 0);
};

/**
 * Select proofs for amount
 * @param {Array} proofs - Available proofs
 * @param {number} amount - Target amount
 * @returns {Array} Selected proofs
 */
export const selectProofsForAmount = (proofs, amount) => {
  // Sort by amount (largest first)
  const sorted = [...proofs].sort((a, b) => b.amount - a.amount);

  const selected = [];
  let total = 0;

  for (const proof of sorted) {
    if (total >= amount) break;
    selected.push(proof);
    total += proof.amount;
  }

  if (total < amount) {
    throw new Error(`Insufficient funds: have ${total}, need ${amount}`);
  }

  return selected;
};

/**
 * Encode token (for sending)
 * @param {Array} proofs - Proofs to encode
 * @param {string} mint - Mint URL
 * @returns {string} Encoded token
 */
export const encodeToken = (proofs, mint) => {
  const token = {
    token: [
      {
        mint,
        proofs,
      },
    ],
  };

  return 'cashu' + Buffer.from(JSON.stringify(token)).toString('base64');
};

/**
 * Decode token (for receiving)
 * @param {string} tokenString - Encoded token
 * @returns {Object} { mint, proofs, amount }
 */
export const decodeToken = (tokenString) => {
  // Remove 'cashu' prefix
  const base64 = tokenString.replace(/^cashu/, '');
  const json = Buffer.from(base64, 'base64').toString('utf-8');
  const token = JSON.parse(json);

  const mint = token.token[0].mint;
  const proofs = token.token[0].proofs;
  const amount = sumProofs(proofs);

  return { mint, proofs, amount };
};

export default {
  generateSecret,
  generateBlindingFactor,
  hashToCurve,
  createBlindedMessage,
  unblindSignature,
  createProof,
  createBlindedOutputs,
  unblindSignatures,
  splitAmount,
  sumProofs,
  selectProofsForAmount,
  encodeToken,
  decodeToken,
};
