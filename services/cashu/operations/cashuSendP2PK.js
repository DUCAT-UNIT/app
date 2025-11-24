/**
 * Cashu Send P2PK Token Operation
 * Handles creating P2PK locked tokens (NUT-11)
 */

import { logger } from '../../../utils/logger';
import { MINT_URL, swapTokens as swapTokensAPI } from '../cashuMintClient';
import {
  createBlindedMessage,
  unblindSignatures,
  splitAmount,
  sumProofs,
  selectProofsForAmount,
  encodeToken,
  generateSecret,
} from '../cashuCrypto';
import {
  createP2PKSecret,
  isP2PKSecret,
} from '../cashuP2PK';
import { getOrFetchKeys, getBalance } from '../cashuBalanceService';
import { loadProofs, removeProofs, addProofs } from '../cashuProofManager';

/**
 * Helper: Create blinded outputs with custom secrets (for P2PK)
 */
const createBlindedOutputsWithSecrets = async (secrets, amounts, keysetId) => {
  const outputs = [];
  const blindingData = [];

  if (secrets.length !== amounts.length) {
    throw new Error('Secrets and amounts length mismatch');
  }

  for (let i = 0; i < secrets.length; i++) {
    const secret = secrets[i];
    const amount = amounts[i];

    const blindedMsg = await createBlindedMessage(secret);

    const output = {
      amount,
      B_: blindedMsg.B_,
    };

    if (keysetId) {
      output.id = keysetId;
    }

    outputs.push(output);

    blindingData.push({
      amount,
      secret: secret,
      r: blindedMsg.r,
      B_: blindedMsg.B_,
    });
  }

  // Sort outputs by amount for privacy (NUT-03)
  const combined = outputs.map((output, i) => ({
    output,
    blindingData: blindingData[i]
  }));

  combined.sort((a, b) => a.output.amount - b.output.amount);

  return {
    outputs: combined.map(c => c.output),
    blindingData: combined.map(c => c.blindingData)
  };
};

/**
 * Send P2PK locked token (NUT-11)
 * Lock tokens to recipient's public key - only they can spend
 *
 * @param {number} amount - Amount to send
 * @param {string} recipientPubkey - Recipient's public key (hex)
 * @param {Object} options - Optional P2PK parameters
 * @returns {Promise<Object>} { token, amount, balance }
 */
export const sendP2PKToken = async (amount, recipientPubkey, options = {}, onProgress) => {
  try {
    const totalSteps = 4; // Selecting, Creating secrets, Swapping, Saving
    let currentStep = 0;

    logger.info('Sending P2PK locked token', { amount, recipientPubkey: recipientPubkey.substring(0, 16) + '...' });


    // Step 1: Select proofs
    if (onProgress) onProgress(++currentStep, totalSteps, 'Selecting proofs');

    // Select proofs - ONLY use unlocked proofs (filter out P2PK locked proofs)
    const allProofs = await loadProofs();
    logger.info('Loaded all proofs for P2PK send', { count: allProofs.length });

    const unlockedProofs = allProofs.filter(p => !isP2PKSecret(p.secret));
    logger.info('Filtered unlocked proofs', { unlocked: unlockedProofs.length, locked: allProofs.length - unlockedProofs.length });

    logger.info('Proof selection for P2PK token', {
      totalProofs: allProofs.length,
      unlockedProofs: unlockedProofs.length,
      lockedProofs: allProofs.length - unlockedProofs.length,
    });

    const selectedProofs = selectProofsForAmount(unlockedProofs, amount);
    // Get total in smallest units (don't use sumProofs which divides by 100)
    const selectedAmount = selectedProofs.reduce((sum, proof) => sum + proof.amount, 0);

    logger.info('Selected proofs for P2PK token', {
      requested: amount,
      selected: selectedAmount,
      proofCount: selectedProofs.length,
    });

    // Get keys
    const keyData = await getOrFetchKeys();
    let keys, keysetId;
    if (keyData.keysets && keyData.keysets.length > 0) {
      keysetId = keyData.keysets[0].id;
      keys = keyData.keysets[0].keys;
    } else {
      keys = keyData.keys || keyData;
    }

    // Step 2: Create P2PK secrets
    if (onProgress) onProgress(++currentStep, totalSteps, 'Creating P2PK secrets');

    // Create P2PK secrets for the send amount
    const sendAmounts = splitAmount(amount);
    const p2pkSecrets = [];

    for (const amt of sendAmounts) {
      const p2pkSecret = await createP2PKSecret(recipientPubkey, options);
      p2pkSecrets.push(p2pkSecret);
    }

    // If we have change, create normal secrets for change
    let changeSecrets = [];
    let changeAmounts = [];
    if (selectedAmount > amount) {
      const changeAmount = selectedAmount - amount;
      logger.info('Creating change for P2PK token', { changeAmount });
      changeAmounts = splitAmount(changeAmount);

      for (const amt of changeAmounts) {
        const secret = await generateSecret();
        changeSecrets.push(secret);
      }
    }

    // CRITICAL: Verify amounts match before swap
    const totalSendAmount = sendAmounts.reduce((sum, amt) => sum + amt, 0);
    const totalChangeAmount = changeAmounts.reduce((sum, amt) => sum + amt, 0);
    const totalOutputAmount = totalSendAmount + totalChangeAmount;

    logger.info('SWAP AMOUNT VERIFICATION', {
      selectedAmount,
      requestedSend: amount,
      sendAmounts,
      changeAmounts,
      totalSendAmount,
      totalChangeAmount,
      totalOutputAmount,
      match: selectedAmount === totalOutputAmount,
    });

    if (selectedAmount !== totalOutputAmount) {
      throw new Error(`Amount mismatch: input=${selectedAmount}, output=${totalOutputAmount}, diff=${selectedAmount - totalOutputAmount}`);
    }

    // Track which secrets are P2PK vs normal (for identification after sorting)
    // This is needed because createBlindedOutputsWithSecrets sorts outputs by amount for privacy
    const secretTypeMap = new Map();
    p2pkSecrets.forEach(secret => secretTypeMap.set(secret, 'p2pk'));
    changeSecrets.forEach(secret => secretTypeMap.set(secret, 'change'));

    // Create blinded outputs using our custom secrets
    // CRITICAL: Secrets and amounts arrays MUST match 1:1
    const allSecrets = [...p2pkSecrets, ...changeSecrets];
    const allAmounts = [...sendAmounts, ...changeAmounts];

    logger.info('Blinded output arrays', {
      secretsCount: allSecrets.length,
      amountsCount: allAmounts.length,
      sendAmounts,
      changeAmounts,
      p2pkSecretsCount: p2pkSecrets.length,
      changeSecretsCount: changeSecrets.length,
    });

    const { outputs, blindingData } = await createBlindedOutputsWithSecrets(allSecrets, allAmounts, keysetId);

    // Step 3: Swap with mint
    if (onProgress) onProgress(++currentStep, totalSteps, 'Swapping with mint');

    // Swap with mint
    const response = await swapTokensAPI(selectedProofs, outputs);

    // Unblind all
    const allNewProofs = unblindSignatures(
      response.signatures,
      blindingData,
      keys,
      response.signatures[0]?.id || keysetId
    );

    // Split into send and change using secret type instead of array slicing
    // This works correctly even after sorting because we identify by the secret itself
    const proofsToSend = allNewProofs.filter(proof => secretTypeMap.get(proof.secret) === 'p2pk');
    const changeProofs = allNewProofs.filter(proof => secretTypeMap.get(proof.secret) === 'change');

    // Debug logging for proof amounts and secret types
    const sendTotal = proofsToSend.reduce((sum, p) => sum + p.amount, 0);
    const changeTotal = changeProofs.reduce((sum, p) => sum + p.amount, 0);
    logger.info('P2PK token split details', {
      requestedAmount: amount,
      selectedAmount,
      sendProofs: proofsToSend.length,
      sendTotal,
      changeProofs: changeProofs.length,
      changeTotal,
      totalReturned: sendTotal + changeTotal,
      difference: selectedAmount - (sendTotal + changeTotal),
    });

    // Log secret types to verify correct identification
    logger.info('Send proof secret types', {
      secrets: proofsToSend.map(p => p.secret.substring(0, 50)),
      areAllP2PK: proofsToSend.every(p => p.secret.startsWith('["P2PK"'))
    });
    logger.info('Change proof secret types', {
      secrets: changeProofs.map(p => p.secret.substring(0, 50)),
      areAllNormal: changeProofs.every(p => !p.secret.startsWith('["P2PK"'))
    });

    // Step 4: Save to wallet
    if (onProgress) onProgress(++currentStep, totalSteps, 'Saving to wallet');

    // Remove spent proofs, add change
    await removeProofs(selectedProofs);
    if (changeProofs.length > 0) {
      await addProofs(changeProofs);
      logger.info('Change proofs added back to wallet', {
        count: changeProofs.length,
        total: changeTotal,
        secrets: changeProofs.map(p => p.secret.substring(0, 20) + '...'),
      });
    }

    // Encode token for sending (P2PK locked)
    const token = encodeToken(proofsToSend, MINT_URL);

    const newBalance = await getBalance();

    logger.info('P2PK token created', { amount, locked: true, newBalance, balanceChange: newBalance - (await loadProofs().then(sumProofs) - selectedAmount) });

    return {
      token,
      amount: sumProofs(proofsToSend),
      balance: newBalance,
    };
  } catch (error) {
    logger.error('Failed to send P2PK token', { error: error.message });
    throw error;
  }
};
