/**
 * Cashu Receive P2PK Token Operation
 * Handles receiving P2PK locked tokens (NUT-11)
 */

import { logger } from '../../../utils/logger';
import { MINT_URL } from '../cashuMintClient';
import {
  createBlindedOutputs,
  unblindSignatures,
  splitAmount,
  sumProofs,
  decodeToken,
  CashuProof,
} from '../crypto';
import {
  isP2PKSecret,
  signP2PKSecret,
} from '../p2pk';
import { getOrFetchKeys } from '../cashuBalanceService';
import { addProofs } from '../cashuProofManager';
import { calculateInputFees, selectActiveUnitKeyset } from '../cashuKeysetUtils';

type ProgressCallback = (current: number, total: number, message: string) => void;

export interface ReceiveP2PKTokenResult {
  amount: number;
  proofCount: number;
}

/**
 * Receive and spend P2PK locked token (NUT-11)
 * Provide your private key to unlock and claim the tokens
 */
export const receiveP2PKToken = async (
  tokenString: string,
  privateKey: string,
  onProgress?: ProgressCallback
): Promise<ReceiveP2PKTokenResult> => {
  const txn = logger.startTransaction('p2pk_receive_token');

  logger.cashu('p2pk_receive_start', {
    step: 'RECEIVE',
    tokenLength: tokenString?.length,
    tokenPrefix: tokenString?.substring(0, 20) + '...',
  });

  try {
    const totalSteps = 6; // Decoding, Signing, Getting keys, Creating outputs, Swapping, Saving
    let currentStep = 0;

    // Step 1: Decode token
    logger.cashu('p2pk_decode_start', { step: 'RECEIVE', substep: 1, message: 'Decoding token' });
    if (onProgress) onProgress(++currentStep, totalSteps, 'Decoding token');
    const decoded = decodeToken(tokenString);

    if (!decoded || !decoded.proofs || !Array.isArray(decoded.proofs)) {
      logger.cashu('p2pk_decode_error', { step: 'RECEIVE', error: 'Invalid token format' });
      throw new Error('Invalid token format');
    }

    const { mint, proofs, amount } = decoded;

    logger.cashu('p2pk_token_decoded', {
      step: 'RECEIVE',
      substep: 1,
      mint: mint?.substring(0, 30) + '...',
      proofCount: proofs.length,
      totalAmount: amount,
    });

    // Verify mint matches
    if (mint !== MINT_URL) {
      logger.cashu('p2pk_mint_mismatch', {
        step: 'RECEIVE',
        expectedMint: MINT_URL?.substring(0, 30),
        actualMint: mint?.substring(0, 30),
      });
      throw new Error(`Token from different mint: ${mint}`);
    }

    // Check if proofs are P2PK locked
    const p2pkProofs = proofs.filter(p => isP2PKSecret(p.secret));
    if (p2pkProofs.length === 0) {
      logger.cashu('p2pk_no_locked_proofs', { step: 'RECEIVE', error: 'Token does not contain P2PK locked proofs' });
      throw new Error('Token does not contain P2PK locked proofs');
    }

    logger.cashu('p2pk_proofs_verified', {
      step: 'RECEIVE',
      substep: 1,
      totalProofs: proofs.length,
      p2pkProofs: p2pkProofs.length,
      message: 'Token contains P2PK locked proofs',
    });

    // Step 2: Sign proofs
    logger.cashu('p2pk_sign_proofs_start', { step: 'RECEIVE', substep: 2, message: 'Signing proofs' });
    if (onProgress) onProgress(++currentStep, totalSteps, 'Signing proofs');

    // Sign each P2PK proof with our private key
    const signedProofs: CashuProof[] = await Promise.all(
      proofs.map(async (proof, index) => {
        if (isP2PKSecret(proof.secret)) {
          logger.cashu('p2pk_signing_individual_proof', {
            step: 'RECEIVE',
            proofIndex: index,
            amount: proof.amount,
          });
          // Create witness signature
          const witness = await signP2PKSecret(proof.secret, privateKey);
          return {
            ...proof,
            witness
          } as CashuProof;
        } else {
          // Non-P2PK proof, no witness needed
          return proof;
        }
      })
    );

    logger.cashu('p2pk_proofs_signed', {
      step: 'RECEIVE',
      substep: 2,
      signedCount: signedProofs.filter(p => p.witness).length,
      message: 'All P2PK proofs signed with witness',
    });

    // Step 3: Get keys
    logger.cashu('p2pk_get_keys_start', { step: 'RECEIVE', substep: 3, message: 'Fetching mint keys' });
    const keyData = await getOrFetchKeys();
    const unitKeyset = selectActiveUnitKeyset(keyData);
    const keysetId = unitKeyset.id;
    const keys = unitKeyset.keys!;

    logger.cashu('p2pk_keys_fetched', {
      step: 'RECEIVE',
      substep: 3,
      keysetId: keysetId?.substring(0, 16),
      keyCount: Object.keys(keys || {}).length,
    });

    // Step 4: Create blinded outputs
    logger.cashu('p2pk_create_outputs_start', { step: 'RECEIVE', substep: 4, message: 'Creating blinded outputs' });
    const totalSmallestUnits = signedProofs.reduce((sum, proof) => sum + proof.amount, 0);
    const inputFees = calculateInputFees(signedProofs, keyData);
    const outputAmount = totalSmallestUnits - inputFees;
    if (outputAmount <= 0) {
      throw new Error('Token amount does not cover mint input fees');
    }
    const amounts = splitAmount(outputAmount);
    const { outputs, blindingData } = await createBlindedOutputs(amounts, keysetId);

    logger.cashu('p2pk_outputs_created', {
      step: 'RECEIVE',
      substep: 4,
      totalAmount: outputAmount,
      inputFees,
      outputCount: outputs.length,
      amounts: amounts.slice(0, 5), // First 5 amounts for brevity
    });

    // Step 5: Swap with mint
    logger.cashu('p2pk_swap_start', {
      step: 'RECEIVE',
      substep: 5,
      message: 'Swapping signed proofs with mint',
      inputProofs: signedProofs.length,
      outputCount: outputs.length,
    });

    // Log detailed proof info for debugging signature issues
    signedProofs.forEach((proof, idx) => {
      let secretParsed: unknown = null;
      let lockedToPubkey: string | null = null;
      try {
        secretParsed = JSON.parse(proof.secret);
        if (Array.isArray(secretParsed) && secretParsed[0] === 'P2PK') {
          lockedToPubkey = (secretParsed[1] as { data?: string })?.data ?? null;
        }
      } catch (e: unknown) { /* ignore */ }

      let witnessSignature: string | null = null;
      try {
        if (proof.witness) {
          const witnessParsed = JSON.parse(proof.witness) as { signatures?: string[] };
          witnessSignature = witnessParsed.signatures?.[0] ?? null;
        }
      } catch (e: unknown) { /* ignore */ }

      logger.cashu('p2pk_swap_proof_detail', {
        step: 'RECEIVE',
        proofIndex: idx,
        amount: proof.amount,
        lockedToPubkey: lockedToPubkey || 'NOT_P2PK',
        hasWitness: !!proof.witness,
        witnessSignaturePrefix: witnessSignature ? witnessSignature.substring(0, 16) + '...' : 'NO_SIGNATURE',
        secretPrefix: proof.secret.substring(0, 16) + '...',
      });
    });

    const { swapTokens: swapTokensAPI } = require('../cashuMintClient');
    const response = await swapTokensAPI(signedProofs, outputs);
    if (!response || !Array.isArray(response.signatures) || response.signatures.length === 0) {
      throw new Error('P2PK verification failed');
    }

    logger.cashu('p2pk_swap_response', {
      step: 'RECEIVE',
      substep: 5,
      signatureCount: response.signatures?.length,
      message: 'Swap successful - received new signatures',
    });

    // Step 6: Unblind and save
    logger.cashu('p2pk_unblind_start', { step: 'RECEIVE', substep: 6, message: 'Unblinding signatures' });
    const newProofs = unblindSignatures(
      response.signatures,
      blindingData,
      keys,
      response.signatures[0]?.id || keysetId
    );

    logger.cashu('p2pk_proofs_unblinded', {
      step: 'RECEIVE',
      substep: 6,
      newProofCount: newProofs.length,
      totalAmount: newProofs.reduce((sum, p) => sum + p.amount, 0),
    });

    // SECURITY: Verify the swap returned proofs matching the expected total amount.
    // A malicious mint could return fewer/different proofs, causing silent fund loss.
    const newProofsTotal = sumProofs(newProofs);
    if (newProofsTotal !== outputAmount) {
      logger.error('SECURITY: Swap proof amount mismatch', {
        expected: outputAmount,
        received: newProofsTotal,
        proofsCount: newProofs.length,
      });
      throw new Error(
        `Swap verification failed: expected ${outputAmount} but received ${newProofsTotal}`
      );
    }

    // Add to wallet
    await addProofs(newProofs, false); // skip strict verification; proofs already validated via mint

    logger.cashu('p2pk_receive_complete', {
      step: 'RECEIVE',
      amount: outputAmount,
      proofCount: newProofs.length,
      message: 'P2PK token successfully claimed and added to wallet',
    });

    txn.finish('ok');

    return {
      amount: outputAmount,
      proofCount: newProofs.length || proofs.length,
    };
  } catch (error: unknown) {
    logger.cashu('p2pk_receive_error', {
      step: 'RECEIVE',
      error: (error as Error).message,
    });
    txn.finish('error');
    logger.error('Failed to receive P2PK token', {
      error: (error as Error).message,
    });

    // Enhanced error message with diagnostic info
    let errorMessage = (error as Error).message;

    // Add diagnostic details to error message for debugging
    if ((error as Error).message.includes('P2PK verification failed') || (error as Error).message.includes('Swap failed')) {
      const diagnostics: string[] = [];

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
        errorMessage = `${errorMessage}\n\nDiagnostics:\n${diagnostics.map(d => `• ${d}`).join('\n')}`;
      }
    }

    const enhancedError = new Error(errorMessage);
    enhancedError.cause = error;
    throw enhancedError;
  }
};
