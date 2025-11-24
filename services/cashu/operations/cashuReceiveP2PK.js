/**
 * Cashu Receive P2PK Token Operation
 * Handles receiving P2PK locked tokens (NUT-11)
 */

import { logger } from '../../../utils/logger';
import { MINT_URL, swapTokens as swapTokensAPI } from '../cashuMintClient';
import {
  createBlindedOutputs,
  unblindSignatures,
  splitAmount,
  decodeToken,
} from '../cashuCrypto';
import {
  isP2PKSecret,
  signP2PKSecret,
} from '../cashuP2PK';
import { getOrFetchKeys } from '../cashuBalanceService';
import { addProofs } from '../cashuProofManager';

/**
 * Receive and spend P2PK locked token (NUT-11)
 * Provide your private key to unlock and claim the tokens
 *
 * @param {string} tokenString - Encoded P2PK token
 * @param {string} privateKey - Your private key to unlock the token (hex)
 * @returns {Promise<Object>} { amount, proofCount }
 */
export const receiveP2PKToken = async (tokenString, privateKey, onProgress) => {
  try {
    const totalSteps = 6; // Decoding, Signing, Getting keys, Creating outputs, Swapping, Saving
    let currentStep = 0;

    logger.info('Receiving P2PK locked token', {
      privateKeyLength: privateKey?.length,
      privateKeyType: typeof privateKey,
      privateKeyPreview: typeof privateKey === 'string' ? privateKey.substring(0, 16) + '...' : 'not a string',
    });


    // Step 1: Decode token
    if (onProgress) onProgress(++currentStep, totalSteps, 'Decoding token');
    const decoded = decodeToken(tokenString);

    if (!decoded || !decoded.proofs || !Array.isArray(decoded.proofs)) {
      throw new Error('Invalid token format');
    }

    const { mint, proofs, amount } = decoded;

    // Verify mint matches
    if (mint !== MINT_URL) {
      throw new Error(`Token from different mint: ${mint}`);
    }

    // Check if proofs are P2PK locked
    const p2pkProofs = proofs.filter(p => isP2PKSecret(p.secret));
    if (p2pkProofs.length === 0) {
      throw new Error('Token does not contain P2PK locked proofs');
    }

    logger.info('Signing P2PK proofs with private key', { proofCount: p2pkProofs.length });

    // Step 2: Sign proofs
    if (onProgress) onProgress(++currentStep, totalSteps, 'Signing proofs');

    // Sign each P2PK proof with our private key
    const signedProofs = await Promise.all(
      proofs.map(async (proof) => {
        if (isP2PKSecret(proof.secret)) {
          // Create witness signature
          const witness = await signP2PKSecret(proof.secret, privateKey);
          return {
            ...proof,
            witness
          };
        } else {
          // Non-P2PK proof, no witness needed
          return proof;
        }
      })
    );

    // Get keys
    const keyData = await getOrFetchKeys();
    let keys, keysetId;
    if (keyData.keysets && keyData.keysets.length > 0) {
      keysetId = keyData.keysets[0].id;
      keys = keyData.keysets[0].keys;
    } else {
      keys = keyData.keys || keyData;
    }

    // Swap the P2PK proofs for regular proofs (this will verify the witness)
    // Use the actual sum in smallest units, not the display amount
    const totalSmallestUnits = signedProofs.reduce((sum, proof) => sum + proof.amount, 0);
    const amounts = splitAmount(totalSmallestUnits);
    const { outputs, blindingData } = await createBlindedOutputs(amounts, keysetId);

    // Swap: give signed P2PK proofs, get regular proofs
    const response = await swapTokensAPI(signedProofs, outputs);

    // Unblind to create our new proofs
    const newProofs = unblindSignatures(
      response.signatures,
      blindingData,
      keys,
      response.signatures[0]?.id || keysetId
    );

    // Add to wallet
    await addProofs(newProofs);

    logger.info('P2PK token received and unlocked', { amount, proofCount: newProofs.length });

    return {
      amount,
      proofCount: newProofs.length,
    };
  } catch (error) {
    logger.error('Failed to receive P2PK token', {
      error: error.message,
      stack: error.stack,
      privateKeyLength: privateKey?.length,
      privateKeyType: typeof privateKey,
    });

    // Enhanced error message with diagnostic info
    let enhancedError = new Error(error.message);
    enhancedError.originalError = error;

    // Add diagnostic details to error message for debugging
    if (error.message.includes('P2PK verification failed') || error.message.includes('Swap failed')) {
      const diagnostics = [];

      // Check private key validity
      if (!privateKey) {
        diagnostics.push('Private key is missing');
      } else if (typeof privateKey !== 'string') {
        diagnostics.push(`Private key type is ${typeof privateKey} (expected string)`);
      } else if (privateKey.length !== 64) {
        diagnostics.push(`Private key length is ${privateKey.length} chars (expected 64)`);
      }

      // Add device info for debugging
      const Platform = require('react-native').Platform;
      diagnostics.push(`Platform: ${Platform.OS} ${Platform.Version}`);

      if (diagnostics.length > 0) {
        enhancedError.message = `${error.message}\n\nDiagnostics:\n${diagnostics.map(d => `• ${d}`).join('\n')}`;
      }
    }

    throw enhancedError;
  }
};
