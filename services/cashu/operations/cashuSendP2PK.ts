/**
 * Cashu Send P2PK Token Operation
 * Handles creating P2PK locked tokens (NUT-11)
 */

import { logger } from '../../../utils/logger';
import { getBalance, getOrFetchKeys } from '../cashuBalanceService';
import { selectActiveUnitKeyset, selectProofsForAmountIncludingFees } from '../cashuKeysetUtils';
import { MINT_URL, swapTokens as swapTokensAPI } from '../cashuMintClient';
import { addProofs, getCurrentCashuAccount, loadProofs, removeProofs } from '../cashuProofManager';
import {
  clearPendingSwap,
  persistOutgoingSwapToken,
  savePendingSwap,
  updateSwapWithResponse,
} from '../cashuSwapRecovery';
import {
  BlindedMessage,
  BlindedOutput,
  BlindingData,
  createBlindedMessage,
  encodeToken,
  generateSecret,
  splitAmount,
  sumProofs,
  unblindSignatures,
} from '../crypto';
import { createP2PKSecret, isP2PKSecret, P2PKOptions } from '../p2pk';

type ProgressCallback = (current: number, total: number, message: string) => void;

export interface SendP2PKTokenResult {
  token: string;
  amount: number;
  balance: number;
}

interface BlindedOutputWithData {
  output: BlindedOutput;
  blindingData: BlindingData;
}

/**
 * Helper: Create blinded outputs with custom secrets (for P2PK)
 */
const createBlindedOutputsWithSecrets = async (
  secrets: string[],
  amounts: number[],
  keysetId: string
): Promise<{ outputs: BlindedOutput[]; blindingData: BlindingData[] }> => {
  const outputs: BlindedOutput[] = [];
  const blindingData: BlindingData[] = [];

  if (secrets.length !== amounts.length) {
    throw new Error('Secrets and amounts length mismatch');
  }

  for (let i = 0; i < secrets.length; i++) {
    const secret = secrets[i];
    const amount = amounts[i];

    const blindedMsg: BlindedMessage = await createBlindedMessage(secret);

    const output: BlindedOutput = {
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

  // Sort outputs by amount per NUT-03
  const combined: BlindedOutputWithData[] = outputs.map((output, i) => ({
    output,
    blindingData: blindingData[i],
  }));

  combined.sort((a, b) => a.output.amount - b.output.amount);

  return {
    outputs: combined.map((c) => c.output),
    blindingData: combined.map((c) => c.blindingData),
  };
};

/**
 * Send P2PK locked token (NUT-11)
 * Lock tokens to recipient's public key - only they can spend
 */
export const sendP2PKToken = async (
  amount: number,
  recipientPubkey: string,
  options: P2PKOptions = {},
  onProgress?: ProgressCallback,
  recipientAddressForRecovery?: string | null
): Promise<SendP2PKTokenResult> => {
  let pendingSwapId: string | null = null;
  try {
    const totalSteps = 4; // Selecting, Creating secrets, Swapping, Saving
    let currentStep = 0;

    logger.info('Sending P2PK locked token', {
      amount,
      recipientPubkeyLength: recipientPubkey.length,
    });

    // Step 1: Select proofs
    if (onProgress) onProgress(++currentStep, totalSteps, 'Selecting proofs');

    // Select proofs - ONLY use unlocked proofs (filter out P2PK locked proofs)
    const allProofs = await loadProofs();
    logger.info('Loaded all proofs for P2PK send', { count: allProofs.length });

    const unlockedProofs = allProofs.filter((p) => !isP2PKSecret(p.secret));
    logger.info('Filtered unlocked proofs', {
      unlocked: unlockedProofs.length,
      locked: allProofs.length - unlockedProofs.length,
    });

    logger.info('Proof selection for P2PK token', {
      totalProofs: allProofs.length,
      unlockedProofs: unlockedProofs.length,
      lockedProofs: allProofs.length - unlockedProofs.length,
    });

    const keyData = await getOrFetchKeys();
    const { selectedProofs, selectedAmount, inputFees } = selectProofsForAmountIncludingFees(
      unlockedProofs,
      amount,
      keyData
    );

    logger.info('Selected proofs for P2PK token', {
      requested: amount,
      selected: selectedAmount,
      inputFees,
      proofCount: selectedProofs.length,
    });

    // Get keys
    const unitKeyset = selectActiveUnitKeyset(keyData);
    const keysetId = unitKeyset.id;
    const keys = unitKeyset.keys!;

    // Step 2: Create P2PK secrets
    if (onProgress) onProgress(++currentStep, totalSteps, 'Creating P2PK secrets');

    // Create P2PK secrets for the send amount
    const sendAmounts = splitAmount(amount);
    const p2pkSecrets: string[] = [];

    for (const _amt of sendAmounts) {
      const p2pkSecret = await createP2PKSecret(recipientPubkey, options);
      p2pkSecrets.push(p2pkSecret);
    }

    // If we have change, create normal secrets for change
    const changeSecrets: string[] = [];
    let changeAmounts: number[] = [];
    if (selectedAmount > amount) {
      const changeAmount = selectedAmount - amount - inputFees;
      logger.info('Creating change for P2PK token', { changeAmount });
      changeAmounts = splitAmount(changeAmount);

      for (const _amt of changeAmounts) {
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
      inputFees,
      match: selectedAmount - inputFees === totalOutputAmount,
    });

    if (selectedAmount - inputFees !== totalOutputAmount) {
      throw new Error(
        `Amount mismatch: input=${selectedAmount}, inputFees=${inputFees}, output=${totalOutputAmount}, diff=${selectedAmount - inputFees - totalOutputAmount}`
      );
    }

    // Track which secrets are P2PK vs normal (for identification after sorting)
    // This is needed because createBlindedOutputsWithSecrets sorts outputs by amount
    const secretTypeMap = new Map<string, 'p2pk' | 'change'>();
    p2pkSecrets.forEach((secret) => secretTypeMap.set(secret, 'p2pk'));
    changeSecrets.forEach((secret) => secretTypeMap.set(secret, 'change'));

    // Convert Map to plain object for serialization
    const secretTypeRecord: Record<string, 'p2pk' | 'change'> = {};
    secretTypeMap.forEach((value, key) => {
      secretTypeRecord[key] = value;
    });

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

    const { outputs, blindingData } = await createBlindedOutputsWithSecrets(
      allSecrets,
      allAmounts,
      keysetId
    );

    // Step 3: Swap with mint (with recovery protection)
    if (onProgress) onProgress(++currentStep, totalSteps, 'Swapping with mint');

    // CRITICAL: Save pending swap BEFORE calling the mint
    // This allows recovery if app crashes after swap but before saving proofs
    pendingSwapId = await savePendingSwap({
      inputProofs: selectedProofs,
      blindingData,
      keys,
      keysetId,
      secretTypeMap: secretTypeRecord,
    });

    // Swap with mint
    const response = await swapTokensAPI(selectedProofs, outputs);

    // CRITICAL: Save the mint's response immediately for recovery
    await updateSwapWithResponse(
      {
        signatures: response.signatures,
      },
      pendingSwapId
    );

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

    // Split into send and change using secret type instead of array slicing
    // This works correctly even after sorting because we identify by the secret itself
    const proofsToSend = allNewProofs.filter((proof) => secretTypeMap.get(proof.secret) === 'p2pk');
    const changeProofs = allNewProofs.filter(
      (proof) => secretTypeMap.get(proof.secret) === 'change'
    );

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
      difference: selectedAmount - inputFees - (sendTotal + changeTotal),
    });

    // Log secret types to verify correct identification
    logger.info('Send proof secret types', {
      count: proofsToSend.length,
      areAllP2PK: proofsToSend.every((p) => p.secret.startsWith('["P2PK"')),
    });
    logger.info('Change proof secret types', {
      count: changeProofs.length,
      areAllNormal: changeProofs.every((p) => !p.secret.startsWith('["P2PK"')),
    });

    // Step 4: Save to wallet (order matters for recovery!)
    if (onProgress) onProgress(++currentStep, totalSteps, 'Saving to wallet');

    // Encode and durably persist the outgoing token before mutating proofs or
    // clearing swap recovery. If the app dies after this point, startup can
    // recover the recipient token from storage.
    const token = encodeToken(proofsToSend, MINT_URL);
    if (pendingSwapId) {
      await persistOutgoingSwapToken({
        id: `${pendingSwapId}:outgoing`,
        token,
        amount: sumProofs(proofsToSend),
        kind: 'p2pk',
        sourceSwapId: pendingSwapId,
        taprootAddress: getCurrentCashuAccount(),
        recipient: recipientAddressForRecovery ?? null,
        createdAt: Date.now(),
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
          total: changeTotal,
        });
      }

      // Now remove the spent proofs
      await removeProofs(selectedProofs);
    } catch (proofError) {
      // If we swapped and have change proofs, we MUST save them
      if (changeProofs.length > 0) {
        logger.warn('Error updating proofs after P2PK swap - attempting to save change proofs', {
          error: (proofError as Error).message,
        });
        try {
          await addProofs(changeProofs);
          logger.info('Successfully saved change proofs after removeProofs failure');
        } catch (saveError) {
          logger.error('CRITICAL: Failed to save change proofs after P2PK swap!', {
            error: (saveError as Error).message,
            changeProofsCount: changeProofs.length,
          });
          throw saveError;
        }
      }
      throw proofError;
    }

    // CRITICAL: Clear the pending swap AFTER all proofs are saved
    await clearPendingSwap(pendingSwapId ?? undefined);

    const newBalance = await getBalance();

    const currentProofs = await loadProofs();
    const currentTotal = sumProofs(currentProofs);
    logger.info('P2PK token created', {
      amount,
      locked: true,
      newBalance,
      balanceChange: newBalance - (currentTotal - selectedAmount),
    });

    return {
      token,
      amount: sumProofs(proofsToSend),
      balance: newBalance,
    };
  } catch (error: unknown) {
    logger.error('Failed to send P2PK token', { error: (error as Error).message });

    // CRITICAL: Recovery — the swap may have already completed on the mint,
    // meaning our selected proofs are spent. We must attempt to recover change
    // proofs from the pending swap data to prevent fund loss.
    // (The swap recovery service will handle this on next startup via savePendingSwap)
    // Note: changeProofs/selectedProofs may not exist if error occurred before swap
    logger.warn('[cashuSendP2PK] P2PK send failed — pending swap data preserved for recovery');

    throw error;
  }
};
