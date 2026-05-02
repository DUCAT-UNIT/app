/**
 * Crypto Blinding - DHKE blinding operations for Cashu (NUT-00)
 */

import * as crypto from 'expo-crypto';
import { Buffer } from 'buffer';
import * as ecc from '@bitcoinerlab/secp256k1';
import { Point } from '@noble/secp256k1';
import { logger } from '../../../utils/logger';
import { generateSecret, generateBlindingFactor } from './cryptoSecrets';
import { CashuProof, createProof } from './cryptoProofs';

export interface BlindedMessage {
  amount: number;
  B_: string;
  secret: string;
  r: string;
}

export interface BlindingData {
  amount: number;
  secret: string;
  r: string;
  B_: string;
}

export interface BlindedOutput {
  amount: number;
  B_: string;
  id?: string;
}

export interface BlindedOutputsResult {
  outputs: BlindedOutput[];
  blindingData: BlindingData[];
}

export interface BlindSignature {
  C_: string;
  id?: string;
}

/**
 * Hash secret to curve point (Y = hash_to_curve(secret))
 * Implements Cashu's hash_to_curve as per NUT-00 specification
 * @param secret - Secret string
 * @returns Compressed public key hex (33 bytes, starts with 02 or 03)
 */
export const hashToCurve = async (secret: string): Promise<string> => {
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
    } catch (_) {
      // Not a valid point on curve, try next counter (expected behavior per NUT-00)
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
 * @param secret - Secret to blind
 * @param blindingFactor - Blinding factor (r)
 * @returns Blinded message
 */
export const createBlindedMessage = async (
  secret: string,
  blindingFactor: string | null = null
): Promise<BlindedMessage> => {
  try {
    // Generate blinding factor if not provided
    const r = blindingFactor || await generateBlindingFactor();

    // Hash secret to curve point Y
    const Y = await hashToCurve(secret);

    // Calculate r*G (public key from blinding factor)
    const rBuffer = Buffer.from(r, 'hex');
    const rG = ecc.pointFromScalar(rBuffer, true);
    if (!rG) {
      throw new Error('Failed to generate point from scalar');
    }

    // B_ = Y + r*G (point addition)
    const YBuffer = Buffer.from(Y, 'hex');
    const rGBuffer = Buffer.from(rG); // Convert Uint8Array to Buffer
    const B_ = ecc.pointAdd(YBuffer, rGBuffer, true);
    if (!B_) {
      throw new Error('Failed to add points');
    }

    return {
      amount: 0, // Will be set by caller
      B_: Buffer.from(B_).toString('hex'), // Convert Uint8Array to Buffer for hex
      secret,
      r,
    };
  } catch (error: unknown) {
    logger.error('Failed to create blinded message', { error: (error as Error).message });
    throw new Error(`Blinding failed: ${(error as Error).message}`);
  }
};

/**
 * Unblind signature
 * C = C_ - r*A where:
 * - C_ = blinded signature from mint
 * - r = blinding factor
 * - A = mint's public key for this amount
 *
 * @param C_ - Blinded signature from mint (hex)
 * @param r - Blinding factor (hex)
 * @param A - Mint public key for this amount (hex)
 * @returns Unblinded signature (C)
 */
export const unblindSignature = (C_: string, r: string, A: string): string => {
  try {
    // C_ - r*A
    const C_Buffer = Buffer.from(C_, 'hex');
    const rBuffer = Buffer.from(r, 'hex');
    const ABuffer = Buffer.from(A, 'hex');

    // Calculate r*A
    const rA = ecc.pointMultiply(ABuffer, rBuffer, true);
    if (!rA) {
      throw new Error('Failed to multiply points');
    }

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
    // SECURITY NOTE: This relies on compressed point format (33 bytes, prefix 02/03)
    // - Prefix 0x02: even y-coordinate
    // - Prefix 0x03: odd y-coordinate
    // - Negating flips parity: (x, y) → (x, -y mod p)
    // This is mathematically correct for secp256k1, but fragile if library changes format.
    // Test coverage validates this assumption holds.
    const negRA = Buffer.from(rABytes);

    // Validate compressed point format before manipulation
    if (negRA.length !== 33) {
      throw new Error(`Invalid point length: expected 33 bytes (compressed), got ${negRA.length}`);
    }

    if (negRA[0] === 0x02) {
      negRA[0] = 0x03; // Even → Odd
    } else if (negRA[0] === 0x03) {
      negRA[0] = 0x02; // Odd → Even
    } else {
      throw new Error(`Invalid point prefix: expected 0x02 or 0x03 (compressed), got 0x${negRA[0].toString(16)}`);
    }

    // C = C_ + (-(r*A)) = C_ - r*A
    const C = ecc.pointAdd(C_Buffer, negRA, true);
    if (!C) {
      throw new Error('Failed to add points for unblinding');
    }

    return Buffer.from(C).toString('hex');
  } catch (error: unknown) {
    logger.error('Failed to unblind signature', { error: (error as Error).message });
    throw new Error(`Unblinding failed: ${(error as Error).message}`);
  }
};

/**
 * Create blinded outputs for amounts (for minting or swapping)
 * @param amounts - Amounts to create outputs for
 * @param keysetId - Optional keyset ID to use (if not provided, outputs won't have id)
 * @returns Array of outputs and blinding data
 */
export const createBlindedOutputs = async (
  amounts: number[],
  keysetId: string | null = null
): Promise<BlindedOutputsResult> => {
  // Create all blinded messages in parallel
  const blindedMessages = await Promise.all(
    amounts.map(async (amount) => {
      const secret = await generateSecret();
      const blindedMsg = await createBlindedMessage(secret);
      blindedMsg.amount = amount;

      const output: BlindedOutput = {
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

  // Sort outputs by amount (ascending) per NUT-03 recommendation
  blindedMessages.sort((a, b) => a.output.amount - b.output.amount);

  return {
    outputs: blindedMessages.map(m => m.output),
    blindingData: blindedMessages.map(m => m.blindingData)
  };
};

/**
 * Unblind signatures and create proofs
 * @param signatures - Blind signatures from mint
 * @param blindingData - Blinding data from createBlindedOutputs
 * @param keys - Mint public keys { amount: pubkey }
 * @param keysetId - Keyset ID
 * @returns Array of Cashu proofs
 */
export const unblindSignatures = (
  signatures: BlindSignature[],
  blindingData: BlindingData[],
  keys: Record<number | string, string>,
  keysetId: string
): CashuProof[] => {
  // Validate signature count matches blinding data count
  if (signatures.length !== blindingData.length) {
    throw new Error(`Signature count mismatch: got ${signatures.length} signatures but ${blindingData.length} blinding data entries`);
  }

  const proofs: CashuProof[] = [];

  for (let i = 0; i < signatures.length; i++) {
    const sig = signatures[i];
    const data = blindingData[i];

    // Get mint's public key for this amount
    const A = keys[data.amount];
    if (!A) {
      throw new Error(`No public key available for amount ${data.amount}. Cannot unblind signature.`);
    }

    // Unblind signature
    const C = unblindSignature(sig.C_, data.r, A);

    // Create proof
    const proof = createProof(data.amount, data.secret, C, sig.id || keysetId);
    proofs.push(proof);
  }

  return proofs;
};
