/**
 * Cashu Send Token Operation
 * Handles creating tokens to send via QR or text
 */

import { logger } from '../../../utils/logger';
import { MINT_URL, swapTokens as swapTokensAPI } from '../cashuMintClient';
import {
  createBlindedOutputs,
  unblindSignatures,
  splitAmount,
  sumProofs,
  selectProofsForAmount,
  encodeToken,
  CashuProof,
} from '../crypto';
import { getOrFetchKeys, getBalance } from '../cashuBalanceService';
import { loadProofs, removeProofs, addProofs } from '../cashuProofManager';

export interface SendTokenResult {
  token: string;
  amount: number;
  balance: number;
}

/**
 * Send Cashu token
 * Creates a token that can be shared via QR code or text
 */
export const sendToken = async (amount: number, returnChange = true): Promise<SendTokenResult> => {
  let selectedProofs: CashuProof[] | null = null;
  let changeProofs: CashuProof[] | null = null;
  let didSwap = false;

  try {
    logger.info('Sending token', { amount, returnChange });

    // Select proofs
    const allProofs = await loadProofs();
    selectedProofs = selectProofsForAmount(allProofs, amount);
    const selectedAmount = sumProofs(selectedProofs);

    logger.info('Selected proofs', {
      selected: selectedAmount,
      needed: amount,
      proofCount: selectedProofs.length,
    });

    let proofsToSend = selectedProofs;
    changeProofs = [];

    // If we need to create change
    if (returnChange && selectedAmount > amount) {
      const changeAmount = selectedAmount - amount;
      logger.info('Creating change', { changeAmount });

      // Get keys first to determine keyset ID
      const keyData = await getOrFetchKeys();
      let keys: Record<string, string>;
      let keysetId: string;
      if (keyData.keysets && keyData.keysets.length > 0) {
        keysetId = keyData.keysets[0].id;
        keys = keyData.keysets[0].keys;
      } else if (keyData.keys) {
        keys = keyData.keys;
        keysetId = '';
      } else {
        throw new Error('No keys available from mint');
      }

      // Split into send + change amounts
      const sendAmounts = splitAmount(amount);
      const changeAmounts = splitAmount(changeAmount);

      // Create blinded outputs for both
      const { outputs, blindingData } = await createBlindedOutputs([
        ...sendAmounts,
        ...changeAmounts,
      ], keysetId);

      // CRITICAL: After this swap, selectedProofs are spent with the mint
      // If any error occurs after this, we MUST save changeProofs to avoid fund loss
      const response = await swapTokensAPI(selectedProofs, outputs);
      didSwap = true;

      // Unblind all
      const allNewProofs = unblindSignatures(
        response.signatures,
        blindingData,
        keys,
        response.signatures[0]?.id || keysetId
      );

      // Split into send and change
      proofsToSend = allNewProofs.slice(0, sendAmounts.length);
      changeProofs = allNewProofs.slice(sendAmounts.length);

      logger.info('Swap completed', {
        sendProofs: proofsToSend.length,
        changeProofs: changeProofs.length,
      });
    }

    // Remove spent proofs, add change
    // Wrap in try-catch to ensure change proofs are saved even if removeProofs fails
    try {
      await removeProofs(selectedProofs);
      if (changeProofs.length > 0) {
        await addProofs(changeProofs);
      }
      logger.info('Successfully updated proofs after swap', {
        removedCount: selectedProofs.length,
        changeCount: changeProofs.length,
      });
    } catch (proofError) {
      // If we swapped and have change proofs, we MUST save them
      if (didSwap && changeProofs && changeProofs.length > 0) {
        logger.warn('Error updating proofs after swap - attempting to save change proofs', {
          error: (proofError as Error).message,
        });
        try {
          // Try to save change proofs even if removeProofs failed
          await addProofs(changeProofs);
          logger.info('Successfully saved change proofs after removeProofs failure', {
            changeCount: changeProofs.length,
          });
        } catch (saveError) {
          logger.error('CRITICAL: Failed to save change proofs after swap!', {
            error: (saveError as Error).message,
            changeProofsCount: changeProofs.length,
          });
          throw saveError;
        }
      }
      throw proofError;
    }

    // Encode token for sending
    const token = encodeToken(proofsToSend, MINT_URL);

    const newBalance = await getBalance();

    logger.info('Token created', { amount, newBalance });

    return {
      token,
      amount: sumProofs(proofsToSend),
      balance: newBalance,
    };
  } catch (error: unknown) {
    logger.error('Failed to send token', { error: (error as Error).message, didSwap });

    // CRITICAL: If we swapped for change but operation failed, we MUST save the change proofs
    // The old proofs are already spent with the mint after the swap
    if (didSwap && changeProofs && changeProofs.length > 0 && selectedProofs) {
      logger.warn('Send token failed after swap - saving change proofs to prevent fund loss');
      try {
        await removeProofs(selectedProofs);
        await addProofs(changeProofs);
        logger.info('Successfully saved change proofs after send token failure', {
          changeCount: changeProofs.length,
        });
      } catch (saveError) {
        logger.error('CRITICAL: Failed to save change proofs after send token failure!', {
          error: (saveError as Error).message,
          changeProofsCount: changeProofs.length,
        });
        // Still throw the original error, but user needs to know about this
      }
    }

    throw error;
  }
};
