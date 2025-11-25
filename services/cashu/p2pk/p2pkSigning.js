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
  try {
    // Hash the secret (message to sign)
    const messageBytes = Buffer.from(secret, 'utf-8');
    const messageHash = createHash('sha256').update(messageBytes).digest();

    // Convert private key to Buffer if needed
    const privateKeyBuffer = typeof privateKey === 'string'
      ? Buffer.from(privateKey, 'hex')
      : privateKey;

    // Ensure both are proper Buffers and correct length
    if (messageHash.length !== 32) {
      throw new Error(`Invalid message hash length: ${messageHash.length}, expected 32`);
    }
    if (privateKeyBuffer.length !== 32) {
      throw new Error(`Invalid private key length: ${privateKeyBuffer.length}, expected 32`);
    }

    // Sign with Schnorr using @bitcoinerlab/secp256k1
    const signature = ecc.signSchnorr(messageHash, privateKeyBuffer);
    const signatureHex = Buffer.from(signature).toString('hex');

    // Create witness structure
    const witness = {
      signatures: [signatureHex]
    };

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
  logger.info('Signing P2PK proofs', { count: proofs.length });

  // Sign all proofs in parallel using Promise.all
  const signedProofs = await Promise.all(
    proofs.map(async (proof) => {
      if (isP2PKLocked(proof)) {
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

  logger.info('Signed P2PK proofs complete', { count: signedProofs.length });
  return signedProofs;
};
