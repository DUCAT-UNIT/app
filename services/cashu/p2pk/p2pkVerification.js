/**
 * P2PK Verification - Verification utilities for P2PK secrets (NUT-11)
 */

import * as crypto from 'expo-crypto';
import { Buffer } from 'buffer';
import { schnorr } from '@noble/secp256k1';
import { logger } from '../../../utils/logger';

/**
 * Check if a secret is a P2PK secret
 * @param {string} secret - Secret to check
 * @returns {boolean} True if P2PK secret
 */
export const isP2PKSecret = (secret) => {
  try {
    const parsed = JSON.parse(secret);
    const isP2PK = Array.isArray(parsed) && parsed[0] === 'P2PK';
    logger.cashu('p2pk_secret_check', {
      step: 'DETECTION',
      isP2PK,
      secretLength: secret?.length,
      secretPreview: secret?.substring(0, 30) + '...',
    });
    return isP2PK;
  } catch {
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
 * @param {string} secret - P2PK secret (serialized JSON)
 * @returns {string|null} Recipient's public key or null
 */
export const getP2PKRecipient = (secret) => {
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
    const pubkey = parsed[1].data;
    logger.cashu('p2pk_recipient_extract', {
      step: 'DETECTION',
      success: true,
      pubkeyLength: pubkey?.length,
      pubkeyPreview: pubkey?.substring(0, 16) + '...',
    });
    return pubkey;
  } catch (error) {
    logger.cashu('p2pk_recipient_extract', {
      step: 'DETECTION',
      success: false,
      error: error.message,
    });
    return null;
  }
};

/**
 * Verify a P2PK witness signature (client-side verification)
 * @param {string} secret - The P2PK secret
 * @param {string} witness - The P2PK witness
 * @param {string} publicKey - Public key to verify against
 * @returns {Promise<boolean>} True if signature is valid
 */
export const verifyP2PKWitness = async (secret, witness, publicKey) => {
  try {
    const witnessData = JSON.parse(witness);
    if (!witnessData.signatures || witnessData.signatures.length === 0) {
      return false;
    }

    // Hash the secret
    const messageBytes = Buffer.from(secret, 'utf-8');
    const messageHash = await crypto.digest(
      crypto.CryptoDigestAlgorithm.SHA256,
      messageBytes
    );

    // Get signature
    const signatureHex = witnessData.signatures[0];
    const signatureBytes = Buffer.from(signatureHex, 'hex');

    // Get public key (remove 02/03 prefix if compressed, schnorr uses x-only)
    let pubkeyBytes;
    if (publicKey.length === 66) {
      // Compressed (02/03 prefix) - take x-coordinate only
      pubkeyBytes = Buffer.from(publicKey.slice(2), 'hex');
    } else if (publicKey.length === 64) {
      // Already x-only
      pubkeyBytes = Buffer.from(publicKey, 'hex');
    } else {
      return false;
    }

    // Verify
    const isValid = schnorr.verify(signatureBytes, messageHash, pubkeyBytes);

    return isValid;
  } catch (error) {
    logger.error('P2PK witness verification failed', { error: error.message });
    return false;
  }
};

/**
 * Check if a proof is P2PK locked
 * @param {Object} proof - Cashu proof object
 * @returns {boolean} True if proof has P2PK secret
 */
export const isP2PKLocked = (proof) => {
  return proof.secret && isP2PKSecret(proof.secret);
};

/**
 * Check if a token string contains P2PK locked proofs
 * @param {string} tokenString - Cashu token string (cashuA...)
 * @returns {boolean} True if token has any P2PK locked proofs
 */
export const hasP2PKProofs = (tokenString) => {
  logger.cashu('p2pk_token_scan_start', {
    step: 'DETECTION',
    tokenLength: tokenString?.length,
    tokenPrefix: tokenString?.substring(0, 20) + '...',
  });

  try {
    // Import decodeToken inline to avoid circular dependency
    const { decodeToken } = require('../crypto');
    const decoded = decodeToken(tokenString);

    if (!decoded.proofs || !Array.isArray(decoded.proofs)) {
      logger.cashu('p2pk_token_scan_result', {
        step: 'DETECTION',
        hasP2PK: false,
        reason: 'No proofs array in token',
      });
      return false;
    }

    const proofCount = decoded.proofs.length;
    const p2pkProofCount = decoded.proofs.filter(p => {
      try {
        const parsed = JSON.parse(p.secret);
        return Array.isArray(parsed) && parsed[0] === 'P2PK';
      } catch {
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
  } catch (error) {
    logger.cashu('p2pk_token_scan_error', {
      step: 'DETECTION',
      error: error.message,
    });
    return false;
  }
};
