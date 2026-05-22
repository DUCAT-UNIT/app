/**
 * Cashu Send Token Operation
 * Handles creating tokens to send via QR or text
 */

import { logger } from '../../../utils/logger';
import {
  assertProofsMatchCashuUnit,
  resolveResponseSignatureKeysetForUnit,
  selectActiveCashuKeyset,
  selectProofsForAmountIncludingFees,
} from '../cashuKeysetUtils';
import {
  MINT_URL,
  swapTokens as swapTokensAPI,
  checkProofsSpent,
  mintRequiresDleqProofs,
} from '../cashuMintClient';
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
import { loadProofs, removeProofs, addProofs, getCurrentCashuAccount } from '../cashuProofManager';
import {
  savePendingSwap,
  updateSwapWithResponse,
  clearPendingSwap,
  persistOutgoingSwapToken,
} from '../cashuSwapRecovery';
import { DEFAULT_CASHU_UNIT, type CashuUnit } from '../cashuUnits';
import {
  assertCashuOperationAccountUnchanged,
  requireCashuOperationAccount,
} from './cashuAccountGuard';
import { isP2PKSecret } from '../p2pk';

export interface SendTokenResult {
  token: string;
  amount: number;
  balance: number;
}

const isDefaultCashuUnit = (unit: CashuUnit): boolean => unit === DEFAULT_CASHU_UNIT;
const loadProofsForUnit = (unit: CashuUnit): Promise<CashuProof[]> =>
  isDefaultCashuUnit(unit) ? loadProofs() : loadProofs(unit);
const addProofsForUnit = (proofs: CashuProof[], unit: CashuUnit, verify = true): Promise<void> =>
  isDefaultCashuUnit(unit) ? addProofs(proofs) : addProofs(proofs, verify, unit);
const removeProofsForUnit = (proofs: CashuProof[], unit: CashuUnit): Promise<void> =>
  isDefaultCashuUnit(unit) ? removeProofs(proofs) : removeProofs(proofs, unit);
const getBalanceForUnit = (unit: CashuUnit): Promise<number> =>
  isDefaultCashuUnit(unit) ? getBalance(true) : getBalance(true, unit);

type OutputKind = 'send' | 'change';

const sumProofAmounts = (proofs: CashuProof[]): number =>
  proofs.reduce((total, proof) => total + proof.amount, 0);

const createTypedBlindedOutputs = async (
  sendAmounts: number[],
  changeAmounts: number[],
  keysetId: string
) => {
  const [sendOutputs, changeOutputs] = await Promise.all([
    createBlindedOutputs(sendAmounts, keysetId),
    createBlindedOutputs(changeAmounts, keysetId),
  ]);

  const typedOutputs: Array<{
    kind: OutputKind;
    output: (typeof sendOutputs.outputs)[number];
    blindingData: (typeof sendOutputs.blindingData)[number];
  }> = [
    ...sendOutputs.outputs.map((output, index) => ({
      kind: 'send' as const,
      output,
      blindingData: sendOutputs.blindingData[index],
    })),
    ...changeOutputs.outputs.map((output, index) => ({
      kind: 'change' as const,
      output,
      blindingData: changeOutputs.blindingData[index],
    })),
  ];

  typedOutputs.sort((a, b) => a.output.amount - b.output.amount);

  const secretTypeMap: Record<string, OutputKind> = {};
  typedOutputs.forEach(({ kind, blindingData }) => {
    secretTypeMap[blindingData.secret] = kind;
  });

  return {
    outputs: typedOutputs.map(({ output }) => output),
    blindingData: typedOutputs.map(({ blindingData }) => blindingData),
    secretTypeMap,
  };
};

/**
 * Send Cashu token
 * Creates a token that can be shared via QR code or text
 */
export const sendToken = async (
  amount: number,
  returnChange = true,
  unit: CashuUnit = DEFAULT_CASHU_UNIT
): Promise<SendTokenResult> => {
  let selectedProofs: CashuProof[] | null = null;
  let changeProofs: CashuProof[] | null = null;
  let didSwap = false;
  let pendingSwapId: string | null = null;
  let outgoingTokenPersisted = false;
  let operationAccount: string | null = null;

  try {
    logger.info('Sending token', { amount, returnChange, unit });
    operationAccount = requireCashuOperationAccount('Cashu send token');

    // Select proofs
    const allProofs = await loadProofsForUnit(unit);
    if (!allProofs || allProofs.length === 0) {
      throw new Error('No funds available');
    }
    const spendableProofs = allProofs.filter((proof) => !isP2PKSecret(proof.secret));
    if (spendableProofs.length === 0) {
      throw new Error('No unlocked funds available');
    }
    const keyData = await getOrFetchKeys();
    const unitKeyset = selectActiveCashuKeyset(keyData, unit);
    const selection = returnChange
      ? selectProofsForAmountIncludingFees(spendableProofs, amount, keyData)
      : {
          selectedProofs: selectProofsForAmount(spendableProofs, amount),
          selectedAmount: 0,
          inputFees: 0,
          requiredAmount: amount,
        };
    selectedProofs = selection.selectedProofs;
    const selectedAmount = selection.selectedAmount || sumProofs(selectedProofs);
    const inputFees = selection.inputFees;
    assertProofsMatchCashuUnit(selectedProofs, keyData, unit, 'Selected Cashu send proofs');

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

      const keysetId = unitKeyset.id;
      const keys = unitKeyset.keys!;

      // Split into send + change amounts
      const sendAmounts = splitAmount(amount);
      const changeAmounts = splitAmount(changeAmount);

      // Create send and change outputs separately, then sort the combined list.
      // createBlindedOutputs sorts by amount, so labeling by final index can
      // misclassify interleaved denominations and create a token for the wrong
      // value.
      const { outputs, blindingData, secretTypeMap } = await createTypedBlindedOutputs(
        sendAmounts,
        changeAmounts,
        keysetId
      );

      // Double-spend guard: verify none of the selected proofs are already spent
      // before writing a swap journal. If this fails, no mint call was made and
      // there is nothing to recover.
      let spentStates: { state: string }[];
      try {
        const spentResult = await checkProofsSpent(selectedProofs);
        if (
          !Array.isArray(spentResult?.states) ||
          spentResult.states.length !== selectedProofs.length
        ) {
          throw new Error('Invalid spent check response');
        }
        spentStates = spentResult.states;
      } catch (spentCheckError) {
        logger.error('[CashuSendToken] Spent check failed - aborting send for safety', {
          error: (spentCheckError as Error).message,
        });
        throw new Error('Unable to verify proof state - aborting send for safety');
      }
      if (spentStates.some((s: { state: string }) => s.state !== 'UNSPENT')) {
        throw new Error('Proofs are not spendable - aborting swap');
      }

      // Persist the pending swap before calling the mint so interrupted sends can recover.
      assertCashuOperationAccountUnchanged(operationAccount, 'Cashu send swap setup');
      pendingSwapId = await savePendingSwap({
        inputProofs: selectedProofs,
        blindingData,
        keys,
        keysetId,
        secretTypeMap: secretTypeMap as Record<string, 'p2pk' | 'send' | 'change'>,
        unit,
      });

      // After this swap, selected proofs may be spent with the mint.
      // Any later failure must preserve change proofs for recovery.
      const requireDleq = await mintRequiresDleqProofs();
      const response = await swapTokensAPI(selectedProofs, outputs);
      didSwap = true;

      const { keysetId: signedKeysetId, keys: unblindKeys } = resolveResponseSignatureKeysetForUnit(
        response.signatures,
        keyData,
        unitKeyset,
        unit,
        `Cashu ${unit} send swap`
      );

      // Persist the mint response immediately; after this point input proofs may be spent.
      await updateSwapWithResponse(
        {
          signatures: response.signatures,
        },
        pendingSwapId,
        { keysetId: signedKeysetId, keys: unblindKeys }
      );

      // Unblind all
      const allNewProofs = unblindSignatures(
        response.signatures,
        blindingData,
        unblindKeys,
        signedKeysetId,
        { requireDleq }
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
      proofsToSend = allNewProofs.filter((proof) => secretTypeMap[proof.secret] === 'send');
      changeProofs = allNewProofs.filter((proof) => secretTypeMap[proof.secret] === 'change');

      const sendProofTotal = sumProofAmounts(proofsToSend);
      const changeProofTotal = sumProofAmounts(changeProofs);
      if (sendProofTotal !== amount || changeProofTotal !== changeAmount) {
        throw new Error(
          `Swap proof classification failed: send=${sendProofTotal}/${amount}, change=${changeProofTotal}/${changeAmount}`
        );
      }

      logger.info('Swap completed', {
        sendProofs: proofsToSend.length,
        changeProofs: changeProofs.length,
      });
    }

    // Encode and journal the outgoing token before mutating local proofs. Swap
    // recovery can reconstruct swap-backed sends; exact sends need their own
    // proof-removal list because no mint swap journal exists.
    const token = encodeToken(proofsToSend, MINT_URL, unit);
    const outgoingRecoveryId =
      pendingSwapId ?? `direct_send_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    assertCashuOperationAccountUnchanged(operationAccount, 'Cashu send token journaling');
    await persistOutgoingSwapToken({
      id: `${outgoingRecoveryId}:outgoing`,
      token,
      amount: sumProofs(proofsToSend),
      kind: 'send',
      sourceSwapId: outgoingRecoveryId,
      taprootAddress: getCurrentCashuAccount(),
      unit,
      proofsToRemove: didSwap ? undefined : proofsToSend,
      createdAt: Date.now(),
    });
    outgoingTokenPersisted = true;

    if (didSwap && pendingSwapId) {
      logger.info('Persisted outgoing swap token recovery record before clearing swap', {
        pendingSwapId,
      });
    }

    // Save change proofs before removing spent proofs so interrupted sends can recover.
    // If we crash after adding change but before removing spent, we might have
    // duplicates, but that's better than losing proofs (duplicates are cleaned
    // up by the mint on next spend attempt)
    try {
      assertCashuOperationAccountUnchanged(operationAccount, 'Cashu send proof update');
      if (changeProofs.length > 0) {
        await addProofsForUnit(changeProofs, unit);
        logger.info('Change proofs added back to wallet', {
          count: changeProofs.length,
        });
      }
      await removeProofsForUnit(selectedProofs, unit);
      logger.info('Successfully updated proofs after swap', {
        removedCount: selectedProofs.length,
        changeCount: changeProofs.length,
      });
    } catch (proofError) {
      // If we swapped and have change proofs, preserve them before surfacing the failure.
      if (didSwap && changeProofs && changeProofs.length > 0) {
        logger.warn('Error updating proofs after swap - attempting to save change proofs', {
          error: (proofError as Error).message,
        });
        try {
          // Try to save change proofs even if removing spent proofs failed.
          await addProofsForUnit(changeProofs, unit);
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

    // Clear the pending swap only after all proof mutations complete.
    if (didSwap) {
      try {
        assertCashuOperationAccountUnchanged(operationAccount, 'Cashu send swap cleanup');
        await clearPendingSwap(pendingSwapId ?? undefined);
      } catch (cleanupError) {
        logger.warn('Pending send swap cleanup failed after token/proof save', {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          pendingSwapId,
          unit,
        });
      }
    }

    const newBalance = await getBalanceForUnit(unit);

    logger.info('Token created', { amount, newBalance });

    return {
      token,
      amount: sumProofs(proofsToSend),
      balance: newBalance,
    };
  } catch (error: unknown) {
    logger.error('Failed to send token', { error: (error as Error).message, didSwap });

    // If the mint swap completed, preserve change proofs before surfacing the failure.
    if (didSwap && changeProofs && changeProofs.length > 0 && selectedProofs) {
      logger.warn('Send token failed after swap - saving change proofs to prevent fund loss');
      try {
        assertCashuOperationAccountUnchanged(operationAccount, 'Cashu send failure recovery');
        // Save change proofs before removing spent proofs.
        await addProofsForUnit(changeProofs, unit);
        await removeProofsForUnit(selectedProofs, unit);
        if (outgoingTokenPersisted) {
          await clearPendingSwap(pendingSwapId ?? undefined);
        }
        logger.info('Successfully saved change proofs after send token failure', {
          changeCount: changeProofs.length,
          outgoingTokenPersisted,
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
