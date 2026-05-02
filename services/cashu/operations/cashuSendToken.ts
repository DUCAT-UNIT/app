/**
 * Cashu Send Token Operation
 * Handles creating tokens to send via QR or text
 */

import { logger } from '../../../utils/logger';
import {
  selectActiveUnitKeyset,
  selectProofsForAmountIncludingFees,
} from '../cashuKeysetUtils';
import { MINT_URL, swapTokens as swapTokensAPI, checkProofsSpent } from '../cashuMintClient';
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
import {
  savePendingSwap,
  updateSwapWithResponse,
  clearPendingSwap,
} from '../cashuSwapRecovery';

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
    if (!allProofs || allProofs.length === 0) {
      throw new Error('No funds available');
    }
    const keyData = await getOrFetchKeys();
    const selection = returnChange
      ? selectProofsForAmountIncludingFees(allProofs, amount, keyData)
      : {
          selectedProofs: selectProofsForAmount(allProofs, amount),
          selectedAmount: 0,
          inputFees: 0,
          requiredAmount: amount,
        };
    selectedProofs = selection.selectedProofs;
    const selectedAmount = selection.selectedAmount || sumProofs(selectedProofs);
    const inputFees = selection.inputFees;

    logger.info('Selected proofs', {
      selected: selectedAmount,
      needed: amount,
      inputFees,
      proofCount: selectedProofs.length,
    });

    let proofsToSend = selectedProofs;
    changeProofs = [];

    // If we need to create change
    if (returnChange && selectedAmount > amount) {
      const changeAmount = selectedAmount - amount - inputFees;
      logger.info('Creating change', { changeAmount });

      // Get keys first to determine keyset ID
      const unitKeyset = selectActiveUnitKeyset(keyData);
      const keysetId = unitKeyset.id;
      const keys = unitKeyset.keys!;

      // Split into send + change amounts
      const sendAmounts = splitAmount(amount);
      const changeAmounts = splitAmount(changeAmount);

      // Create blinded outputs for both
      const { outputs, blindingData } = await createBlindedOutputs([
        ...sendAmounts,
        ...changeAmounts,
      ], keysetId);

      // Track which secrets are send vs change (by index before sorting)
      // For regular sendToken, first N outputs are send, rest are change
      const secretTypeMap: Record<string, 'send' | 'change'> = {};
      blindingData.forEach((data, index) => {
        secretTypeMap[data.secret] = index < sendAmounts.length ? 'send' : 'change';
      });

      // CRITICAL: Save pending swap BEFORE calling the mint
      // This allows recovery if app crashes after swap but before saving proofs
      await savePendingSwap({
        inputProofs: selectedProofs,
        blindingData,
        keys,
        keysetId,
        secretTypeMap: secretTypeMap as Record<string, 'p2pk' | 'change'>,
      });

      // Double-spend guard: verify none of the selected proofs are already spent
      let spentStates: { state: string }[];
      try {
        const spentResult = await checkProofsSpent(selectedProofs);
        if (!Array.isArray(spentResult?.states)) {
          throw new Error('Invalid spent check response');
        }
        spentStates = spentResult.states;
      } catch (spentCheckError) {
        logger.error('[CashuSendToken] Spent check failed - aborting send for safety', {
          error: (spentCheckError as Error).message,
        });
        throw new Error('Unable to verify proof state - aborting send for safety');
      }
      if (spentStates.some((s: { state: string }) => s.state === 'SPENT')) {
        throw new Error('Proofs already spent - aborting swap');
      }

      // CRITICAL: After this swap, selectedProofs are spent with the mint
      // If any error occurs after this, we MUST save changeProofs to avoid fund loss
      const response = await swapTokensAPI(selectedProofs, outputs);
      didSwap = true;

      // CRITICAL: Save the mint's response immediately for recovery
      await updateSwapWithResponse({
        signatures: response.signatures,
      });

      // Unblind all
      const allNewProofs = unblindSignatures(
        response.signatures,
        blindingData,
        keys,
        response.signatures[0]?.id || keysetId
      );

      // SECURITY: Verify the swap returned proofs matching the expected total amount.
      // A malicious mint could return fewer/different proofs, causing silent fund loss.
      const newProofsTotal = sumProofs(allNewProofs);
      const expectedOutputAmount = selectedAmount - inputFees;
      if (newProofsTotal !== expectedOutputAmount) {
        logger.error('SECURITY: Swap proof amount mismatch', {
          expected: expectedOutputAmount,
          received: newProofsTotal,
          proofsCount: allNewProofs.length,
        });
        throw new Error(
          `Swap verification failed: expected ${expectedOutputAmount} but received ${newProofsTotal}`
        );
      }

      // Split into send and change using secret type (handles sorted outputs correctly)
      proofsToSend = allNewProofs.filter(proof => secretTypeMap[proof.secret] === 'send');
      changeProofs = allNewProofs.filter(proof => secretTypeMap[proof.secret] === 'change');

      logger.info('Swap completed', {
        sendProofs: proofsToSend.length,
        changeProofs: changeProofs.length,
      });
    }

    // CRITICAL: Save change proofs FIRST, then remove spent proofs
    // This order ensures we never lose change if app crashes mid-operation
    // If we crash after adding change but before removing spent, we might have
    // duplicates, but that's better than losing proofs (duplicates are cleaned
    // up by the mint on next spend attempt)
    try {
      if (changeProofs.length > 0) {
        await addProofs(changeProofs);
        logger.info('Change proofs added back to wallet', {
          count: changeProofs.length,
        });
      }
      await removeProofs(selectedProofs);
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

    // CRITICAL: Clear the pending swap AFTER all proofs are saved
    if (didSwap) {
      await clearPendingSwap();
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
        // Save change proofs FIRST
        await addProofs(changeProofs);
        await removeProofs(selectedProofs);
        // Clear pending swap after successful recovery
        await clearPendingSwap();
        logger.info('Successfully saved change proofs after send token failure', {
          changeCount: changeProofs.length,
        });
      } catch (saveError) {
        logger.error('CRITICAL: Failed to save change proofs after send token failure!', {
          error: (saveError as Error).message,
          changeProofsCount: changeProofs.length,
        });
        // Don't clear pending swap - recovery will try again on next startup
        // Still throw the original error, but user needs to know about this
      }
    }

    throw error;
  }
};
