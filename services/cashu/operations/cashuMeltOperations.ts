/**
 * Cashu Melt Operations
 * Handles redeeming Cashu UNIT tokens through the onchain/unit mint method.
 */

import { logger } from '../../../utils/logger';
import {
  calculateInputFees,
  findKeysetById,
  selectActiveUnitKeyset,
  selectProofsForAmountIncludingFees,
} from '../cashuKeysetUtils';
import {
  createMeltQuote,
  meltTokens as meltTokensAPI,
  swapTokens as swapTokensAPI,
  MeltQuote,
  MeltResponse,
} from '../cashuMintClient';
import type { MintKeys } from '../cashuMintClient';
import { createBlindedOutputs, unblindSignatures, sumProofs, CashuProof } from '../crypto';
import type { BlindedOutput, BlindingData } from '../crypto';
import { getOrFetchKeys, getBalance } from '../cashuBalanceService';
import { loadProofs, removeProofs, addProofs, removeSpentProofs } from '../cashuProofManager';
import { clearPendingSwap, savePendingSwap, updateSwapWithResponse } from '../cashuSwapRecovery';
import { normalizeCashuAmount, normalizeOptionalCashuAmount } from '../cashuTsCompat';
import { isP2PKSecret } from '../p2pk';

export interface MeltQuoteResult {
  quoteId: string;
  amount: number;
  fee: number;
  total: number;
}

const MAX_MELT_QUOTE_ATTEMPTS = 6;

const loadSpendableProofsForMelt = async (): Promise<CashuProof[]> => {
  const allProofs = await loadProofs();
  return allProofs.filter((p) => !isP2PKSecret(p.secret));
};

const canCoverMeltTotal = (
  proofs: CashuProof[],
  totalAmount: number,
  keyData: MintKeys
): boolean => {
  try {
    selectProofsForAmountIncludingFees(proofs, totalAmount, keyData);
    return true;
  } catch (_) {
    return false;
  }
};

/**
 * Redeem tokens through the onchain/unit melt flow.
 * Step 1: Create melt quote
 */
export const requestMelt = async (address: string, amount: number): Promise<MeltQuoteResult> => {
  try {
    logger.info('Requesting melt', { address, amount });

    const quote: MeltQuote = await createMeltQuote(address, amount);
    if (quote.amount === undefined) {
      throw new Error('Melt quote missing amount');
    }

    return {
      quoteId: quote.quote,
      amount: quote.amount,
      fee: quote.fee ?? quote.fee_reserve ?? 0,
      total: quote.amount + (quote.fee ?? quote.fee_reserve ?? 0),
    };
  } catch (error: unknown) {
    logger.error('Failed to request melt', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Create a melt quote for the largest amount that can be paid from the
 * available TurboUNIT balance after the mint fee and Cashu input fees.
 */
export const requestMaxMelt = async (
  address: string,
  availableAmount: number
): Promise<MeltQuoteResult> => {
  try {
    const requestedAvailableAmount = Math.floor(availableAmount);
    if (!Number.isFinite(requestedAvailableAmount) || requestedAvailableAmount <= 0) {
      throw new Error('No TurboUNIT available to withdraw');
    }

    const keyData = await getOrFetchKeys();
    const spendableProofs = await loadSpendableProofsForMelt();
    const proofBalance = sumProofs(spendableProofs);
    const maxSpendableAmount = Math.min(requestedAvailableAmount, proofBalance);

    if (maxSpendableAmount <= 0) {
      throw new Error('No unlocked TurboUNIT proofs available to withdraw');
    }

    const maxInputFees = calculateInputFees(spendableProofs, keyData);
    let quoteAmount = maxSpendableAmount;
    let lastQuote: MeltQuoteResult | null = null;

    for (let attempt = 0; attempt < MAX_MELT_QUOTE_ATTEMPTS; attempt++) {
      const quote = await requestMelt(address, quoteAmount);
      lastQuote = quote;

      if (
        quote.total <= maxSpendableAmount &&
        canCoverMeltTotal(spendableProofs, quote.total, keyData)
      ) {
        logger.info('Max melt quote selected', {
          requestedAvailableAmount,
          proofBalance,
          amount: quote.amount,
          fee: quote.fee,
          total: quote.total,
          attempt: attempt + 1,
        });
        return quote;
      }

      const balanceDeficit = Math.max(0, quote.total - maxSpendableAmount);
      const reserveDeficit = Math.max(balanceDeficit, maxInputFees, 1);
      const nextQuoteAmount = Math.floor(quote.amount - reserveDeficit);

      if (nextQuoteAmount <= 0) {
        break;
      }

      quoteAmount = nextQuoteAmount >= quoteAmount ? quoteAmount - 1 : nextQuoteAmount;
    }

    if ((lastQuote?.fee ?? 0) >= maxSpendableAmount) {
      throw new Error('Not enough TurboUNIT to cover the on-chain withdrawal fee.');
    }
    throw new Error('Not enough TurboUNIT to cover the withdrawal amount plus fees.');
  } catch (error: unknown) {
    logger.error('Failed to request max melt', { error: (error as Error).message });
    throw error;
  }
};

export interface MeltResult {
  paid: boolean;
  txid: string;
  fee: number;
  balance: number;
}

interface PreparedMeltSpend {
  selectedProofs: CashuProof[];
  proofsToMelt: CashuProof[];
  didPreSwap: boolean;
}

const splitMeltChangeAmount = (amount: number, keys: Record<number | string, string>): number[] => {
  const denominations: number[] = [];
  let remaining = amount;
  let bit = 1;

  while (remaining > 0) {
    if (remaining % 2 === 1) {
      denominations.push(bit);
    }
    remaining = Math.floor(remaining / 2);
    bit *= 2;
  }

  denominations.reverse();

  const missingDenomination = denominations.find((denomination) => !keys[denomination]);
  if (missingDenomination !== undefined) {
    throw new Error(`Mint keyset cannot sign melt change denomination ${missingDenomination}`);
  }

  return denominations;
};

interface ExactMeltPlan {
  total: number;
  amounts: number[];
  inputFees: number;
}

interface TypedBlindedOutput {
  output: BlindedOutput;
  blindingData: BlindingData;
  type: 'melt' | 'change';
}

const getInputFeeForOutputCount = (
  outputCount: number,
  keyData: MintKeys,
  keysetId: string
): number => {
  const keyset = findKeysetById(keyData, keysetId);
  const inputFeePpk = normalizeCashuAmount(keyset?.input_fee_ppk ?? 0, 'input_fee_ppk');
  return Math.floor((outputCount * inputFeePpk + 999) / 1000);
};

const getExactMeltPlan = (
  baseAmount: number,
  keyData: MintKeys,
  keysetId: string,
  keys: Record<number | string, string>
): ExactMeltPlan => {
  let total = baseAmount;

  for (let attempt = 0; attempt < 10; attempt++) {
    const amounts = splitMeltChangeAmount(total, keys);
    const inputFees = getInputFeeForOutputCount(amounts.length, keyData, keysetId);
    const nextTotal = baseAmount + inputFees;

    if (nextTotal === total) {
      return { total, amounts, inputFees };
    }

    total = nextTotal;
  }

  throw new Error('Unable to calculate exact melt proof amount with input fees');
};

const createTypedBlindedOutputs = async (
  meltAmounts: number[],
  changeAmounts: number[],
  keysetId: string
): Promise<{
  outputs: BlindedOutput[];
  blindingData: BlindingData[];
  meltSecrets: Set<string>;
  recoverySecretTypeMap: Record<string, 'change'>;
}> => {
  const melt = await createBlindedOutputs(meltAmounts, keysetId);
  const change =
    changeAmounts.length > 0
      ? await createBlindedOutputs(changeAmounts, keysetId)
      : { outputs: [] as BlindedOutput[], blindingData: [] as BlindingData[] };

  const pairs: TypedBlindedOutput[] = [
    ...melt.outputs.map((output, index) => ({
      output,
      blindingData: melt.blindingData[index],
      type: 'melt' as const,
    })),
    ...change.outputs.map((output, index) => ({
      output,
      blindingData: change.blindingData[index],
      type: 'change' as const,
    })),
  ].sort((a, b) => a.output.amount - b.output.amount);

  const meltSecrets = new Set(
    pairs.filter((pair) => pair.type === 'melt').map((pair) => pair.blindingData.secret)
  );
  const recoverySecretTypeMap = Object.fromEntries(
    pairs.map((pair) => [pair.blindingData.secret, 'change' as const])
  );

  return {
    outputs: pairs.map((pair) => pair.output),
    blindingData: pairs.map((pair) => pair.blindingData),
    meltSecrets,
    recoverySecretTypeMap,
  };
};

const prepareExactMeltProofs = async (
  selectedProofs: CashuProof[],
  selectedAmount: number,
  inputFees: number,
  exactMeltPlan: ExactMeltPlan,
  keyData: MintKeys
): Promise<CashuProof[]> => {
  const unitKeyset = selectActiveUnitKeyset(keyData);
  const keysetId = unitKeyset.id;
  const keys = unitKeyset.keys!;
  const outputAmount = selectedAmount - inputFees;
  const changeAmount = outputAmount - exactMeltPlan.total;

  if (changeAmount < 0) {
    throw new Error('Selected proofs do not cover exact melt amount plus input fees');
  }

  const changeAmounts = changeAmount > 0 ? splitMeltChangeAmount(changeAmount, keys) : [];
  const { outputs, blindingData, meltSecrets, recoverySecretTypeMap } =
    await createTypedBlindedOutputs(exactMeltPlan.amounts, changeAmounts, keysetId);

  const pendingSwapId = await savePendingSwap({
    inputProofs: selectedProofs,
    blindingData,
    keys,
    keysetId,
    // If the app exits after swap but before melt, all swapped proofs should
    // be restored as normal wallet proofs by the existing swap recovery path.
    secretTypeMap: recoverySecretTypeMap,
  });

  const response = await swapTokensAPI(selectedProofs, outputs);
  await updateSwapWithResponse(
    {
      signatures: response.signatures,
    },
    pendingSwapId
  );

  const signedKeysetId = response.signatures[0]?.id || keysetId;
  const signedKeyset = findKeysetById(keyData, signedKeysetId);
  const unblindKeys = signedKeyset?.keys ?? keys;
  const allNewProofs = unblindSignatures(
    response.signatures,
    blindingData,
    unblindKeys,
    signedKeysetId
  );

  const expectedOutputAmount = selectedAmount - inputFees;
  const actualOutputAmount = sumProofs(allNewProofs);
  if (actualOutputAmount !== expectedOutputAmount) {
    throw new Error(
      `Swap verification failed: expected ${expectedOutputAmount} but received ${actualOutputAmount}`
    );
  }

  const proofsToMelt = allNewProofs.filter((proof) => meltSecrets.has(proof.secret));
  if (sumProofs(proofsToMelt) !== exactMeltPlan.total) {
    throw new Error(
      `Swap verification failed: exact melt proofs do not total ${exactMeltPlan.total}`
    );
  }

  await addProofs(allNewProofs);
  await removeProofs(selectedProofs);
  await clearPendingSwap(pendingSwapId);

  logger.info('Prepared exact proofs for melt via swap', {
    selectedAmount,
    inputFees,
    exactMeltTotal: exactMeltPlan.total,
    changeAmount,
    meltProofCount: proofsToMelt.length,
    outputCount: outputs.length,
  });

  return proofsToMelt;
};

const prepareMeltSpend = async (
  baseAmount: number,
  keyData: MintKeys
): Promise<PreparedMeltSpend> => {
  const allProofs = await loadProofs();
  const spendableProofs = allProofs.filter((p) => !isP2PKSecret(p.secret));

  logger.info('Proofs loaded for melt', {
    count: allProofs.length,
    spendableCount: spendableProofs.length,
    lockedCount: allProofs.length - spendableProofs.length,
    proofs: spendableProofs.map((p) => ({ amount: p.amount, id: p.id })),
  });

  const unitKeyset = selectActiveUnitKeyset(keyData);
  const exactMeltPlan = getExactMeltPlan(baseAmount, keyData, unitKeyset.id, unitKeyset.keys!);
  const { selectedProofs, selectedAmount, inputFees } = selectProofsForAmountIncludingFees(
    spendableProofs,
    exactMeltPlan.total,
    keyData
  );

  const directChangeAmount = selectedAmount - baseAmount - inputFees;
  if (directChangeAmount < 0) {
    throw new Error('Selected proofs do not cover melt amount plus input fees');
  }

  if (directChangeAmount === 0) {
    return {
      selectedProofs,
      proofsToMelt: selectedProofs,
      didPreSwap: false,
    };
  }

  const proofsToMelt = await prepareExactMeltProofs(
    selectedProofs,
    selectedAmount,
    inputFees,
    exactMeltPlan,
    keyData
  );

  return {
    selectedProofs,
    proofsToMelt,
    didPreSwap: true,
  };
};

const ACCEPTED_MELT_STATES = new Set(['PAID', 'PENDING']);

const isMeltPaid = (result: Pick<MeltResponse, 'paid' | 'state'>): boolean =>
  result.paid === true ||
  (typeof result.state === 'string' && ACCEPTED_MELT_STATES.has(result.state));

const assertMeltPaid = (result: Pick<MeltResponse, 'paid' | 'state'>): void => {
  if (!isMeltPaid(result)) {
    const state = result.state ? ` State: ${result.state}.` : '';
    throw new Error(`Mint did not confirm the withdrawal.${state}`);
  }
};

const getMeltTxid = (
  result: Pick<MeltResponse, 'txid' | 'outpoint' | 'payment_preimage' | 'quote'>
): string => {
  if (result.txid) return result.txid;
  if (result.outpoint) return result.outpoint.split(':')[0] || result.outpoint;
  return result.payment_preimage || result.quote || '';
};

const getMeltFee = (result: Pick<MeltResponse, 'fee_paid' | 'fee'>): number => {
  const feePaid = normalizeOptionalCashuAmount(result.fee_paid, 'melt fee_paid');
  if (feePaid !== undefined) return feePaid;
  return normalizeOptionalCashuAmount(result.fee, 'melt fee') ?? 0;
};

/**
 * Complete melt through the onchain/unit flow.
 * Step 2: Send proofs and optional change outputs to the mint.
 */
export const completeMelt = async (quoteId: string, totalAmount: number): Promise<MeltResult> => {
  let preparedSpend: PreparedMeltSpend | null = null;

  try {
    logger.info('Completing melt', { quoteId, totalAmount });

    const keyData = await getOrFetchKeys();
    const prepared = await prepareMeltSpend(totalAmount, keyData);
    preparedSpend = prepared;

    // Melt exact proofs only. The advertised onchain/unit response does not
    // return NUT-08 change, so any needed change is created via swap first.
    const result = await meltTokensAPI(quoteId, prepared.proofsToMelt, []);
    assertMeltPaid(result);

    // ONLY NOW that melt succeeded, remove the proofs that were submitted.
    // Pre-swap change was already saved before melt submission.
    await removeProofs(prepared.proofsToMelt);
    logger.info('Melt succeeded - removed spent proofs', {
      count: prepared.proofsToMelt.length,
      didPreSwap: prepared.didPreSwap,
    });

    const newBalance = await getBalance();

    logger.info('Melt completed', {
      paid: result.paid,
      txid: getMeltTxid(result),
      newBalance,
    });

    return {
      paid: isMeltPaid(result),
      txid: getMeltTxid(result),
      fee: getMeltFee(result),
      balance: newBalance,
    };
  } catch (error: unknown) {
    const originalError = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to complete melt', {
      error: originalError.message,
      hasPreparedSpend: !!preparedSpend,
      didPreSwap: preparedSpend?.didPreSwap ?? false,
    });
    try {
      const cleanup = await removeSpentProofs();
      logger.info('Reconciled proofs after failed melt', {
        removed: cleanup.removed,
        kept: cleanup.kept,
        didPreSwap: preparedSpend?.didPreSwap ?? false,
      });
    } catch (cleanupError) {
      logger.warn('Failed to reconcile proofs after failed melt', {
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
    }
    throw originalError;
  }
};

export interface MeltWithoutCleanupResult {
  paid: boolean;
  txid: string;
  fee: number;
  proofsToRemove: CashuProof[];
  changeProofs: CashuProof[] | null;
}

export type MeltSubmissionStatus = 'not_submitted' | 'unknown' | 'accepted' | 'rejected';

export interface MeltOperationError extends Error {
  meltSubmissionStatus?: MeltSubmissionStatus;
  spentProofsRemoved?: number;
}

/**
 * Complete melt without removing proofs - for fuse flow
 * Returns the proofs that need to be removed so caller can wait for tx confirmation
 */
export const completeMeltWithoutCleanup = async (
  quoteId: string,
  totalAmount: number
): Promise<MeltWithoutCleanupResult> => {
  let preparedSpend: PreparedMeltSpend | null = null;
  let submissionStatus: MeltSubmissionStatus = 'not_submitted';

  try {
    logger.info('Completing melt without cleanup', { quoteId, totalAmount });

    const keyData = await getOrFetchKeys();
    const prepared = await prepareMeltSpend(totalAmount, keyData);
    preparedSpend = prepared;

    // Melt tokens
    submissionStatus = 'unknown';
    const result = await meltTokensAPI(quoteId, prepared.proofsToMelt, []);
    submissionStatus = isMeltPaid(result) ? 'accepted' : 'rejected';
    assertMeltPaid(result);

    logger.info('Melt completed without cleanup', {
      paid: result.paid,
      state: result.state,
      txid: getMeltTxid(result),
      didPreSwap: prepared.didPreSwap,
    });

    // Return the proofs that need to be removed later
    return {
      paid: isMeltPaid(result),
      txid: getMeltTxid(result),
      fee: getMeltFee(result),
      proofsToRemove: prepared.proofsToMelt,
      changeProofs: null,
    };
  } catch (error: unknown) {
    const originalError = error instanceof Error ? error : new Error(String(error));
    let spentProofsRemoved = 0;

    logger.error('Failed to complete melt without cleanup', {
      error: originalError.message,
      hasPreparedSpend: !!preparedSpend,
      didPreSwap: preparedSpend?.didPreSwap ?? false,
      submissionStatus,
    });
    if (preparedSpend && submissionStatus !== 'not_submitted') {
      try {
        const cleanup = await removeSpentProofs();
        spentProofsRemoved = cleanup.removed;
        logger.info('Reconciled proofs after failed melt without cleanup', {
          removed: cleanup.removed,
          kept: cleanup.kept,
          didPreSwap: preparedSpend.didPreSwap,
          submissionStatus,
        });
      } catch (cleanupError) {
        logger.warn('Failed to reconcile proofs after failed melt without cleanup', {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          submissionStatus,
        });
      }
    }

    const enrichedError = originalError as MeltOperationError;
    enrichedError.meltSubmissionStatus = submissionStatus;
    enrichedError.spentProofsRemoved = spentProofsRemoved;
    throw enrichedError;
  }
};

/**
 * Clean up proofs after melt transaction is confirmed
 */
export const cleanupMeltProofs = async (
  proofsToRemove: CashuProof[],
  changeProofs: CashuProof[] | null
): Promise<void> => {
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
  } catch (error: unknown) {
    logger.error('Failed to cleanup melt proofs', { error: (error as Error).message });
    throw error;
  }
};
