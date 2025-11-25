/**
 * P2PK Signing - Signing operations for P2PK proofs (NUT-11)
 */

import { Buffer } from 'buffer';
import * as ecc from '@bitcoinerlab/secp256k1';
import { createHash } from 'react-native-quick-crypto';
import { logger } from '../../../utils/logger';
import { isP2PKLocked } from './p2pkVerification';

/**
 * Sign a P2PK secret to create a witness
 * @param {string} secret - The P2PK secret to sign (serialized JSON)
 * @param {string} privateKey - Private key to sign with (hex)
 * @returns {Promise<string>} P2PK witness (serialized JSON)
 */
export const signP2PKSecret = async (secret, privateKey) => {
  logger.cashu('p2pk_sign_start', {
    step: 'SIGNING',
    secretLength: secret?.length,
    secretPreview: secret?.substring(0, 40) + '...',
    privateKeyLength: privateKey?.length,
    privateKeyType: typeof privateKey,
  });

  try {
    // Hash the secret (message to sign)
    const messageBytes = Buffer.from(secret, 'utf-8');
    const messageHash = createHash('sha256').update(messageBytes).digest();

    logger.cashu('p2pk_message_hashed', {
      step: 'SIGNING',
      messageHashLength: messageHash.length,
      messageHashHex: Buffer.from(messageHash).toString('hex').substring(0, 16) + '...',
    });

    // Convert private key to Buffer if needed
    const privateKeyBuffer = typeof privateKey === 'string'
      ? Buffer.from(privateKey, 'hex')
      : privateKey;

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
      signaturePreview: signatureHex.substring(0, 32) + '...',
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
  } catch (error) {
    logger.error('Failed to sign P2PK secret', { error: error.message });

    // Create enhanced error with diagnostics for user
    const diagnostics = [];

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
          diagnostics.push(`⚠️ Expected 64 chars, got ${privateKey.length}`);
        }
      } else {
        diagnostics.push(`⚠️ Private key is ${typeof privateKey}, expected string`);
      }
    } else {
      diagnostics.push('⚠️ Private key is null/undefined');
    }

    // Add original error details
    diagnostics.push(`Error: ${error.message}`);

    const enhancedMessage = `P2PK signing failed\n\n${diagnostics.join('\n')}`;
    throw new Error(enhancedMessage);
  }
};

/**
 * Sign P2PK locked proofs with witness signatures
 * @param {Array<Object>} proofs - Array of Cashu proofs
 * @param {string} privateKey - Private key to sign with (hex, 32 bytes)
 * @returns {Promise<Array<Object>>} Proofs with witness signatures added
 */
export const signP2PKProofs = async (proofs, privateKey) => {
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
