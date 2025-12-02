/**
 * P2PK Signing - Signing operations for P2PK proofs (NUT-11)
 *
 * Implements Schnorr signature creation for Pay-to-Public-Key locked Cashu tokens.
 * P2PK proofs require a valid Schnorr signature witness to be redeemed.
 *
 * @see https://github.com/cashubtc/nuts/blob/main/11.md - NUT-11: Pay to Public Key
 */

import { Buffer } from 'buffer';
import * as ecc from '@bitcoinerlab/secp256k1';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createHash } = require('react-native-quick-crypto');
import { logger } from '../../../utils/logger';
import { isP2PKLocked, CashuProof } from './p2pkVerification';

/**
 * Sign a P2PK secret to create a witness for token redemption
 * Creates a Schnorr signature over SHA256(secret) using the provided private key
 *
 * @param secret - The P2PK secret to sign (JSON array: ["P2PK", { data: pubkey, ... }])
 * @param privateKey - 32-byte private key in hex format (64 characters)
 * @returns P2PK witness as JSON string: { signatures: [sig_hex] }
 * @throws Error if secret or private key is invalid, or if signing fails
 *
 * @example
 * const witness = await signP2PKSecret(
 *   '["P2PK", {"data": "02abc..."}]',
 *   'deadbeef...'
 * );
 * // Returns: '{"signatures":["abc123..."]}'
 */
/** P2PK secret structure: ["P2PK", { data: pubkey, ... }] */
type P2PKSecretParsed = ['P2PK', { data?: string; [key: string]: unknown }];

export const signP2PKSecret = async (secret: string, privateKey: string): Promise<string> => {
  // Parse secret to extract P2PK details for debugging
  let secretParsed: P2PKSecretParsed | null = null;
  let expectedPubkey: string | null = null;
  try {
    const parsed = JSON.parse(secret) as unknown;
    if (Array.isArray(parsed) && parsed[0] === 'P2PK') {
      secretParsed = parsed as P2PKSecretParsed;
      expectedPubkey = secretParsed[1]?.data ?? null;
    }
  } catch (_e: unknown) {
    // Ignore parse errors
  }

  logger.cashu('p2pk_sign_start', {
    step: 'SIGNING',
    secretLength: secret?.length ?? 0,
    secretPreview: secret ? secret.substring(0, 40) + '...' : 'NULL',
    privateKeyLength: privateKey?.length ?? 0,
    privateKeyType: typeof privateKey,
    expectedPubkey: expectedPubkey ?? 'UNKNOWN',
    expectedPubkeyLength: expectedPubkey?.length ?? 0,
  });

  try {
    // Hash the secret (message to sign)
    const messageBytes = Buffer.from(secret, 'utf-8');
    const messageHash = createHash('sha256').update(messageBytes).digest();

    logger.cashu('p2pk_message_hashed', {
      step: 'SIGNING',
      messageHashLength: messageHash.length,
      messageHashHex: Buffer.from(messageHash).toString('hex'),
    });

    // Convert private key to Buffer if needed
    const privateKeyBuffer = typeof privateKey === 'string'
      ? Buffer.from(privateKey, 'hex')
      : privateKey;

    // Derive public key from private key for debugging comparison
    let derivedPubkey: string | null = null;
    try {
      const pubkeyFull = ecc.pointFromScalar(privateKeyBuffer);
      if (pubkeyFull) {
        // Get x-only pubkey (32 bytes) for Schnorr - remove the 02/03 prefix
        derivedPubkey = Buffer.from(pubkeyFull).slice(1).toString('hex');
      }
    } catch (e: unknown) {
      logger.cashu('p2pk_pubkey_derivation_failed', {
        step: 'SIGNING',
        error: (e as Error).message,
      });
    }

    logger.cashu('p2pk_key_comparison', {
      step: 'SIGNING',
      expectedPubkey: expectedPubkey || 'NOT_FOUND_IN_SECRET',
      derivedPubkey: derivedPubkey || 'DERIVATION_FAILED',
      pubkeysMatch: expectedPubkey && derivedPubkey ? expectedPubkey === derivedPubkey : 'CANNOT_COMPARE',
      privateKeyFirst8: typeof privateKey === 'string' ? privateKey.substring(0, 8) + '...' : 'BUFFER',
    });

    // Ensure both are proper Buffers and correct length
    if (messageHash.length !== 32) {
      logger.cashu('p2pk_sign_error', {
        step: 'SIGNING',
        error: 'Invalid message hash length',
        expected: 32,
        actual: messageHash.length,
      });
      throw new Error(`Invalid message hash length: ${messageHash.length}, expected 32`);
    }
    if (privateKeyBuffer.length !== 32) {
      logger.cashu('p2pk_sign_error', {
        step: 'SIGNING',
        error: 'Invalid private key length',
        expected: 32,
        actual: privateKeyBuffer.length,
      });
      throw new Error(`Invalid private key length: ${privateKeyBuffer.length}, expected 32`);
    }

    // Sign with Schnorr using @bitcoinerlab/secp256k1
    const signature = ecc.signSchnorr(messageHash, privateKeyBuffer);
    const signatureHex = Buffer.from(signature).toString('hex');

    logger.cashu('p2pk_signature_created', {
      step: 'SIGNING',
      signatureLength: signatureHex.length,
      signatureFull: signatureHex,
      expectedPubkey: expectedPubkey || 'UNKNOWN',
      derivedPubkey: derivedPubkey || 'UNKNOWN',
    });

    // Create witness structure
    const witness = {
      signatures: [signatureHex]
    };

    logger.cashu('p2pk_witness_created', {
      step: 'SIGNING',
      witnessLength: JSON.stringify(witness).length,
      message: 'Schnorr signature witness created successfully',
    });

    return JSON.stringify(witness);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to sign P2PK secret', { error: errorMessage });

    // Create enhanced error with diagnostics for user
    const diagnostics: string[] = [];

    // Capture what we know
    if (secret) {
      diagnostics.push(`Secret length: ${secret.length}`);
    } else {
      diagnostics.push('Secret is null/undefined');
    }

    if (privateKey) {
      if (typeof privateKey === 'string') {
        diagnostics.push(`Private key length: ${privateKey.length} chars`);
        if (privateKey.length !== 64) {
          diagnostics.push(`Expected 64 chars, got ${privateKey.length}`);
        }
      } else {
        diagnostics.push(`Private key is ${typeof privateKey}, expected string`);
      }
    } else {
      diagnostics.push('Private key is null/undefined');
    }

    // Add original error details
    diagnostics.push(`Error: ${errorMessage}`);

    const enhancedMessage = `P2PK signing failed\n\n${diagnostics.join('\n')}`;
    throw new Error(enhancedMessage);
  }
};

/**
 * Sign all P2PK locked proofs in a batch with witness signatures
 * Non-P2PK proofs are passed through unchanged
 *
 * @param proofs - Array of Cashu proofs (may include both P2PK and regular proofs)
 * @param privateKey - 32-byte private key in hex format (64 characters)
 * @returns Array of proofs with witness signatures added to P2PK-locked ones
 * @throws Error if any P2PK proof fails to sign
 *
 * @example
 * const signedProofs = await signP2PKProofs(mixedProofs, walletPrivateKey);
 * // P2PK proofs now have witness field, regular proofs unchanged
 */
export const signP2PKProofs = async (proofs: CashuProof[], privateKey: string): Promise<CashuProof[]> => {
  const p2pkCount = proofs.filter(p => isP2PKLocked(p)).length;

  logger.cashu('p2pk_batch_sign_start', {
    step: 'SIGNING',
    totalProofs: proofs.length,
    p2pkProofs: p2pkCount,
    regularProofs: proofs.length - p2pkCount,
    privateKeyLength: privateKey?.length,
  });

  const startTime = Date.now();

  // Sign all proofs in parallel using Promise.all
  const signedProofs = await Promise.all(
    proofs.map(async (proof, index) => {
      if (isP2PKLocked(proof)) {
        logger.cashu('p2pk_signing_proof', {
          step: 'SIGNING',
          proofIndex: index,
          amount: proof.amount,
          secretPreview: proof.secret?.substring(0, 30) + '...',
        });

        // Sign the P2PK secret to create witness
        const witness = await signP2PKSecret(proof.secret, privateKey);

        // Add witness to proof
        return {
          ...proof,
          witness
        };
      } else {
        // Not P2PK locked, no witness needed
        return proof;
      }
    })
  );

  const signingTimeMs = Date.now() - startTime;

  logger.cashu('p2pk_batch_sign_complete', {
    step: 'SIGNING',
    totalProofs: signedProofs.length,
    signedProofs: signedProofs.filter(p => p.witness).length,
    signingTimeMs,
    message: 'All P2PK proofs signed successfully',
  });

  return signedProofs;
};
