/**
 * Cashu Melt Operations
 * Handles redeeming tokens for Bitcoin/Runes
 */

import { logger } from '../../../utils/logger';
import {
  createMeltQuote,
  meltTokens as meltTokensAPI,
  swapTokens as swapTokensAPI,
} from '../cashuMintClient';
import {
  createBlindedOutputs,
  unblindSignatures,
  splitAmount,
  sumProofs,
  selectProofsForAmount,
} from '../cashuCrypto';
import { getOrFetchKeys, getBalance } from '../cashuBalanceService';
import { loadProofs, removeProofs, addProofs } from '../cashuProofManager';

/**
 * Redeem tokens for Runes (melt)
 * Step 1: Create melt quote
 *
 * @param {string} address - Taproot address to send Runes to
 * @param {number} amount - Amount in sats
 * @returns {Promise<Object>} Melt quote with fee
 */
export const requestMelt = async (address, amount) => {
  try {
    logger.info('Requesting melt', { address, amount });

    const quote = await createMeltQuote(address, amount);

    return {
      quoteId: quote.quote,
      amount: quote.amount,
      fee: quote.fee_reserve,
      total: quote.amount + quote.fee_reserve,
    };
  } catch (error) {
    logger.error('Failed to request melt', { error: error.message });
    throw error;
  }
};

/**
 * Complete melt (redeem tokens for Runes)
 * Step 2: Send proofs to mint and get Runes
 *
 * @param {string} quoteId - Melt quote ID
 * @param {number} totalAmount - Total amount including fee
 * @returns {Promise<Object>} Payment result with txid
 */
export const completeMelt = async (quoteId, totalAmount) => {
  let selectedProofs = null;
  let changeProofs = null;
  let didSwap = false;

  try {
    logger.info('Completing melt', { quoteId, totalAmount });

    // Select proofs
    const allProofs = await loadProofs();

    // Debug: Log the proofs we're about to use
    logger.info('Proofs loaded for melt', {
      count: allProofs.length,
      proofIds: allProofs.map(p => ({ amount: p.amount, id: p.id, secretPreview: p.secret?.substring(0, 8) }))
    });

    selectedProofs = selectProofsForAmount(allProofs, totalAmount);
    const selectedAmount = sumProofs(selectedProofs);

    // If we have change, swap first
    let proofsToMelt = selectedProofs;

    if (selectedAmount > totalAmount) {
      const changeAmount = selectedAmount - totalAmount;
      logger.info('Creating change for melt', { changeAmount });

      // Get keys first to determine keyset ID
      const keyData = await getOrFetchKeys();
      let keys, keysetId;
      if (keyData.keysets && keyData.keysets.length > 0) {
        keysetId = keyData.keysets[0].id;
        keys = keyData.keysets[0].keys;
      } else {
        keys = keyData.keys || keyData;
      }

      const meltAmounts = splitAmount(totalAmount);
      const changeAmounts = splitAmount(changeAmount);

      const { outputs, blindingData } = await createBlindedOutputs([
        ...meltAmounts,
        ...changeAmounts,
      ], keysetId);

      // CRITICAL: After this swap, selectedProofs are spent with the mint
      // If melt fails after this, we MUST save changeProofs to avoid fund loss
      const response = await swapTokensAPI(selectedProofs, outputs);
      didSwap = true;

      const allNewProofs = unblindSignatures(
        response.signatures,
        blindingData,
        keys,
        response.signatures[0]?.id || keysetId
      );

      proofsToMelt = allNewProofs.slice(0, meltAmounts.length);
      changeProofs = allNewProofs.slice(meltAmounts.length);

      // DON'T remove/add proofs yet - wait for melt confirmation
    }

    // Melt tokens - this is the critical step that broadcasts the transaction
    const result = await meltTokensAPI(quoteId, proofsToMelt);

    // ONLY NOW that melt succeeded, remove the spent proofs
    if (changeProofs) {
      // Had change: remove old proofs, add change
      await removeProofs(selectedProofs);
      await addProofs(changeProofs);
      logger.info('Melt succeeded - removed old proofs and added change', {
        removedCount: selectedProofs.length,
        changeCount: changeProofs.length,
      });
    } else {
      // No change: just remove the proofs
      await removeProofs(selectedProofs);
      logger.info('Melt succeeded - removed spent proofs', { count: selectedProofs.length });
    }

    const newBalance = await getBalance();

    logger.info('Melt completed', {
      paid: result.paid,
      txid: result.payment_preimage,
      newBalance,
    });

    return {
      paid: result.paid,
      txid: result.payment_preimage,
      fee: result.fee_paid || 0,
      balance: newBalance,
    };
  } catch (error) {
    logger.error('Failed to complete melt', { error: error.message, didSwap });

    // CRITICAL: If we swapped for change but melt failed, we MUST save the change proofs
    // The old proofs are already spent with the mint after the swap
    if (didSwap && changeProofs && selectedProofs) {
      logger.warn('Melt failed after swap - saving change proofs to prevent fund loss');
      try {
        await removeProofs(selectedProofs);
        await addProofs(changeProofs);
        logger.info('Successfully saved change proofs after melt failure', {
          changeCount: changeProofs.length,
        });
      } catch (saveError) {
        logger.error('CRITICAL: Failed to save change proofs after melt failure!', {
          error: saveError.message,
          changeProofsCount: changeProofs.length,
        });
        // Still throw the original error, but user needs to know about this
      }
    }

    throw error;
  }
};

/**
 * Complete melt without removing proofs - for fuse flow
 * Returns the proofs that need to be removed so caller can wait for tx confirmation
 * @param {string} quoteId - Melt quote ID
 * @param {number} totalAmount - Total amount to melt
 * @returns {Promise<Object>} Result with proofsToRemove and changeProofs
 */
export const completeMeltWithoutCleanup = async (quoteId, totalAmount) => {
  let selectedProofs = null;
  let changeProofs = null;
  let didSwap = false;

  try {
    logger.info('Completing melt without cleanup', { quoteId, totalAmount });

    // Select proofs
    const allProofs = await loadProofs();
    selectedProofs = selectProofsForAmount(allProofs, totalAmount);
    const selectedAmount = sumProofs(selectedProofs);

    // If we have change, swap first
    let proofsToMelt = selectedProofs;

    if (selectedAmount > totalAmount) {
      const changeAmount = selectedAmount - totalAmount;
      logger.info('Creating change for melt', { changeAmount });

      const keyData = await getOrFetchKeys();
      let keys, keysetId;
      if (keyData.keysets && keyData.keysets.length > 0) {
        keysetId = keyData.keysets[0].id;
        keys = keyData.keysets[0].keys;
      } else {
        keys = keyData.keys || keyData;
      }

      const meltAmounts = splitAmount(totalAmount);
      const changeAmounts = splitAmount(changeAmount);

      const { outputs, blindingData } = await createBlindedOutputs([
        ...meltAmounts,
        ...changeAmounts,
      ], keysetId);

      const response = await swapTokensAPI(selectedProofs, outputs);
      didSwap = true;

      const allNewProofs = unblindSignatures(
        response.signatures,
        blindingData,
        keys,
        response.signatures[0]?.id || keysetId
      );

      proofsToMelt = allNewProofs.slice(0, meltAmounts.length);
      changeProofs = allNewProofs.slice(meltAmounts.length);
    }

    // Melt tokens
    const result = await meltTokensAPI(quoteId, proofsToMelt);

    logger.info('Melt completed without cleanup', {
      paid: result.paid,
      txid: result.payment_preimage,
    });

    // Return the proofs that need to be removed later
    // IMPORTANT: If we swapped for change, we need to remove ALL old proofs (selectedProofs)
    // because they were already swapped. The proofsToMelt and changeProofs are the NEW proofs.
    // But proofsToMelt was spent in the melt, so we only keep changeProofs.
    return {
      paid: result.paid,
      txid: result.payment_preimage,
      fee: result.fee_paid || 0,
      proofsToRemove: didSwap ? [...selectedProofs] : proofsToMelt,
      changeProofs: changeProofs,
    };
  } catch (error) {
    logger.error('Failed to complete melt without cleanup', { error: error.message, didSwap });

    // CRITICAL: If we swapped for change but melt failed, we MUST save the change proofs
    if (didSwap && changeProofs && selectedProofs) {
      logger.warn('Melt failed after swap - saving change proofs to prevent fund loss');
      try {
        await removeProofs(selectedProofs);
        await addProofs(changeProofs);
        logger.info('Successfully saved change proofs after melt failure');
      } catch (saveError) {
        logger.error('CRITICAL: Failed to save change proofs after melt failure!', {
          error: saveError.message,
        });
      }
    }

    throw error;
  }
};

/**
 * Clean up proofs after melt transaction is confirmed
 * @param {Array} proofsToRemove - Proofs to remove
 * @param {Array} changeProofs - Change proofs to add (can be null)
 */
export const cleanupMeltProofs = async (proofsToRemove, changeProofs) => {
  try {
    if (changeProofs) {
      await removeProofs(proofsToRemove);
      await addProofs(changeProofs);
      logger.info('Cleaned up melt proofs with change', {
        removedCount: proofsToRemove.length,
        changeCount: changeProofs.length,
      });
    } else {
      await removeProofs(proofsToRemove);
      logger.info('Cleaned up melt proofs', { count: proofsToRemove.length });
    }
  } catch (error) {
    logger.error('Failed to cleanup melt proofs', { error: error.message });
    throw error;
  }
};
