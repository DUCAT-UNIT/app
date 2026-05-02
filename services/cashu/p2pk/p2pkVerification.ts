/**
 * P2PK Verification - Verification utilities for P2PK secrets (NUT-11)
 */

import { Buffer } from 'buffer';
import { schnorr } from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { logger } from '../../../utils/logger';
import type { CashuProof as CoreCashuProof } from '../crypto/cryptoProofs';

export type CashuProof = CoreCashuProof;

/**
 * Check if a secret is a P2PK secret
 */
export const isP2PKSecret = (secret: string): boolean => {
  try {
    const parsed = JSON.parse(secret);
    const isP2PK = Array.isArray(parsed) && parsed[0] === 'P2PK';
    logger.cashu('p2pk_secret_check', {
      step: 'DETECTION',
      isP2PK,
      secretLength: secret?.length,
    });
    return isP2PK;
  } catch (_) {
    // Not JSON format - this is expected for regular (non-P2PK) secrets
    logger.cashu('p2pk_secret_check', {
      step: 'DETECTION',
      isP2PK: false,
      reason: 'Failed to parse secret as JSON',
    });
    return false;
  }
};

/**
 * Extract recipient public key from P2PK secret
 * @returns Recipient's public key or null
 */
export const getP2PKRecipient = (secret: string): string | null => {
  try {
    const parsed = JSON.parse(secret);
    if (!Array.isArray(parsed) || parsed[0] !== 'P2PK') {
      logger.cashu('p2pk_recipient_extract', {
        step: 'DETECTION',
        success: false,
        reason: 'Not a P2PK secret format',
      });
      return null;
    }
    if (!parsed[1] || typeof parsed[1] !== 'object' || typeof parsed[1].data !== 'string') {
      logger.cashu('p2pk_recipient_extract', {
        step: 'DETECTION',
        success: false,
        reason: 'Malformed P2PK secret - missing data field',
      });
      return null;
    }
    const pubkey = parsed[1].data;
    logger.cashu('p2pk_recipient_extract', {
      step: 'DETECTION',
      success: true,
      pubkeyLength: pubkey?.length,
    });
    return pubkey;
  } catch (error: unknown) {
    logger.cashu('p2pk_recipient_extract', {
      step: 'DETECTION',
      success: false,
      error: (error as Error).message,
    });
    return null;
  }
};

/**
 * Verify a P2PK witness signature (client-side verification)
 * @returns True if signature is valid
 */
export const verifyP2PKWitness = async (
  secret: string,
  witness: string,
  publicKey: string
): Promise<boolean> => {
  try {
    const witnessData = JSON.parse(witness);
    if (!witnessData.signatures || witnessData.signatures.length === 0) {
      return false;
    }

    // Hash the secret using pure JS (@noble/hashes) to avoid native C++ crashes
    const messageBytes = Buffer.from(secret, 'utf-8');
    const messageHash = sha256(new Uint8Array(messageBytes));

    // Validate and decode signature (Schnorr signatures are exactly 64 bytes = 128 hex chars)
    const signatureHex = witnessData.signatures[0];
    if (typeof signatureHex !== 'string' || signatureHex.length !== 128 || !/^[0-9a-f]{128}$/i.test(signatureHex)) {
      return false;
    }
    const signatureBytes = Buffer.from(signatureHex, 'hex');

    // Get public key (remove 02/03 prefix if compressed, schnorr uses x-only)
    let pubkeyBytes: Buffer;
    if (publicKey.length === 66) {
      // Compressed (02/03 prefix) - take x-coordinate only
      pubkeyBytes = Buffer.from(publicKey.slice(2), 'hex');
    } else if (publicKey.length === 64) {
      // Already x-only
      pubkeyBytes = Buffer.from(publicKey, 'hex');
    } else {
      return false;
    }

    // Verify (returns boolean or string depending on library version)
    // Use verifyAsync if sync verify crashes in native layer
    let verifyResult;
    try {
      verifyResult = schnorr.verify(signatureBytes, messageHash, pubkeyBytes);
    } catch (nativeErr: unknown) {
      // schnorr.verify may crash in react-native-quick-crypto's C++ layer
      // Try async path as fallback
      try {
        verifyResult = await schnorr.verify(signatureBytes, messageHash, pubkeyBytes);
      } catch {
        logger.warn('[P2PK] schnorr.verify crashed in native layer, treating as invalid', {
          error: (nativeErr as Error).message,
        });
        return false;
      }
    }
    return Boolean(verifyResult);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('[P2PK] Witness verification error', {
      error: err.message,
    });
    return false;
  }
};

/**
 * Check if a proof is P2PK locked
 */
export const isP2PKLocked = (proof: CashuProof): boolean => {
  return Boolean(proof.secret && isP2PKSecret(proof.secret));
};

/**
 * Check if a token string contains P2PK locked proofs
 * @returns True if token has any P2PK locked proofs
 */
export const hasP2PKProofs = (tokenString: string): boolean => {
  logger.cashu('p2pk_token_scan_start', {
    step: 'DETECTION',
    tokenLength: tokenString?.length,
  });

  try {
    // Import inline to avoid circular dependency.
    const { decodeTokenMetadata } = require('../crypto');
    const decoded = decodeTokenMetadata(tokenString);

    if (!decoded.proofs || !Array.isArray(decoded.proofs)) {
      logger.cashu('p2pk_token_scan_result', {
        step: 'DETECTION',
        hasP2PK: false,
        reason: 'No proofs array in token',
      });
      return false;
    }

    const proofCount = decoded.proofs.length;
    const p2pkProofCount = decoded.proofs.filter((p: CashuProof) => {
      try {
        const parsed = JSON.parse(p.secret) as unknown;
        return Array.isArray(parsed) && parsed[0] === 'P2PK';
      } catch (_) {
        // Not JSON format - expected for regular secrets
        return false;
      }
    }).length;

    const hasP2PK = p2pkProofCount > 0;

    logger.cashu('p2pk_token_scan_result', {
      step: 'DETECTION',
      hasP2PK,
      totalProofs: proofCount,
      p2pkProofs: p2pkProofCount,
      regularProofs: proofCount - p2pkProofCount,
    });

    return hasP2PK;
  } catch (error: unknown) {
    logger.cashu('p2pk_token_scan_error', {
      step: 'DETECTION',
      error: (error as Error).message,
    });
    return false;
  }
};
