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
} from '../crypto';
import { getOrFetchKeys, getBalance } from '../cashuBalanceService';
import { loadProofs, removeProofs, addProofs } from '../cashuProofManager';

/**
 * Send Cashu token
 * Creates a token that can be shared via QR code or text
 *
 * @param {number} amount - Amount to send
 * @param {boolean} returnChange - Whether to create change proofs
 * @returns {Promise<Object>} Encoded token and remaining balance
 */
export const sendToken = async (amount, returnChange = true) => {
  try {
    logger.info('Sending token', { amount, returnChange });

    // Select proofs
    const allProofs = await loadProofs();
    const selectedProofs = selectProofsForAmount(allProofs, amount);
    const selectedAmount = sumProofs(selectedProofs);

    logger.info('Selected proofs', {
      selected: selectedAmount,
      needed: amount,
      proofCount: selectedProofs.length,
    });

    let proofsToSend = selectedProofs;
    let changeProofs = [];

    // If we need to create change
    if (returnChange && selectedAmount > amount) {
      const changeAmount = selectedAmount - amount;
      logger.info('Creating change', { changeAmount });

      // Get keys first to determine keyset ID
      const keyData = await getOrFetchKeys();
      let keys, keysetId;
      if (keyData.keysets && keyData.keysets.length > 0) {
        keysetId = keyData.keysets[0].id;
        keys = keyData.keysets[0].keys;
      } else {
        keys = keyData.keys || keyData;
      }

      // Split into send + change amounts
      const sendAmounts = splitAmount(amount);
      const changeAmounts = splitAmount(changeAmount);

      // Create blinded outputs for both
      const { outputs, blindingData } = await createBlindedOutputs([
        ...sendAmounts,
        ...changeAmounts,
      ], keysetId);

      // Swap with mint
      const response = await swapTokensAPI(selectedProofs, outputs);

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
    await removeProofs(selectedProofs);
    if (changeProofs.length > 0) {
      await addProofs(changeProofs);
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
  } catch (error) {
    logger.error('Failed to send token', { error: error.message });
    throw error;
  }
};
