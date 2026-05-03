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
  MeltQuote,
  MeltResponse,
} from '../cashuMintClient';
import type { MintKeys } from '../cashuMintClient';
import {
  createBlindedOutputs,
  unblindSignatures,
  splitAmount,
  sumProofs,
  CashuProof,
} from '../crypto';
import { getOrFetchKeys, getBalance } from '../cashuBalanceService';
import { loadProofs, removeProofs, addProofs } from '../cashuProofManager';
import { normalizeOptionalCashuAmount, type CashuAmountLike } from '../cashuTsCompat';
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
  return allProofs.filter(p => !isP2PKSecret(p.secret));
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
export const requestMaxMelt = async (address: string, availableAmount: number): Promise<MeltQuoteResult> => {
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

      quoteAmount = nextQuoteAmount >= quoteAmount
        ? quoteAmount - 1
        : nextQuoteAmount;
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
  changeOutputs: Array<{ amount: number; B_: string; id?: string }>;
  changeBlindingData: Parameters<typeof unblindSignatures>[1];
  changeKeys: Record<number | string, string>;
  changeKeysetId: string;
}

const prepareMeltSpend = async (baseAmount: number, keyData: MintKeys): Promise<PreparedMeltSpend> => {
  const allProofs = await loadProofs();
  const spendableProofs = allProofs.filter(p => !isP2PKSecret(p.secret));

  logger.info('Proofs loaded for melt', {
    count: allProofs.length,
    spendableCount: spendableProofs.length,
    lockedCount: allProofs.length - spendableProofs.length,
    proofs: spendableProofs.map(p => ({ amount: p.amount, id: p.id }))
  });

  const {
    selectedProofs,
    selectedAmount,
    inputFees,
  } = selectProofsForAmountIncludingFees(spendableProofs, baseAmount, keyData);

  const changeAmount = selectedAmount - baseAmount - inputFees;
  if (changeAmount < 0) {
    throw new Error('Selected proofs do not cover melt amount plus input fees');
  }

  if (changeAmount === 0) {
    return {
      selectedProofs,
      proofsToMelt: selectedProofs,
      changeOutputs: [],
      changeBlindingData: [],
      changeKeys: {},
      changeKeysetId: '',
    };
  }

  const unitKeyset = selectActiveUnitKeyset(keyData);
  const changeAmounts = splitAmount(changeAmount);
  const { outputs, blindingData } = await createBlindedOutputs(changeAmounts, unitKeyset.id);

  return {
    selectedProofs,
    proofsToMelt: selectedProofs,
    changeOutputs: outputs,
    changeBlindingData: blindingData,
    changeKeys: unitKeyset.keys!,
    changeKeysetId: unitKeyset.id,
  };
};

const unblindMeltChange = (
  resultChange: Array<{ C_: string; id?: string; amount?: CashuAmountLike }> | undefined,
  prepared: PreparedMeltSpend,
  keyData: MintKeys
): CashuProof[] | null => {
  if (prepared.changeOutputs.length === 0) {
    return null;
  }

  if (!resultChange || resultChange.length === 0) {
    throw new Error('Mint did not return melt change signatures');
  }

  const signedKeysetId = resultChange[0]?.id || prepared.changeKeysetId;
  const signedKeyset = signedKeysetId
    ? findKeysetById(keyData, signedKeysetId)
    : undefined;
  const keys = signedKeyset?.keys ?? prepared.changeKeys;

  return unblindSignatures(
    resultChange,
    prepared.changeBlindingData,
    keys,
    signedKeysetId || prepared.changeKeysetId
  );
};

const ACCEPTED_MELT_STATES = new Set(['PAID', 'PENDING']);

const isMeltPaid = (result: Pick<MeltResponse, 'paid' | 'state'>): boolean =>
  result.paid === true || (typeof result.state === 'string' && ACCEPTED_MELT_STATES.has(result.state));

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
  let changeProofs: CashuProof[] | null = null;
  let selectedProofs: CashuProof[] | null = null;

  try {
    logger.info('Completing melt', { quoteId, totalAmount });

    const keyData = await getOrFetchKeys();
    const prepared = await prepareMeltSpend(totalAmount, keyData);
    selectedProofs = prepared.selectedProofs;

    // Melt tokens - this is the critical step that broadcasts the transaction
    const result = await meltTokensAPI(quoteId, prepared.proofsToMelt, prepared.changeOutputs);
    assertMeltPaid(result);
    changeProofs = unblindMeltChange(result.change, prepared, keyData);

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
    logger.error('Failed to complete melt', { error: (error as Error).message, hasSelectedProofs: !!selectedProofs });
    throw error;
  }
};

export interface MeltWithoutCleanupResult {
  paid: boolean;
  txid: string;
  fee: number;
  proofsToRemove: CashuProof[];
  changeProofs: CashuProof[] | null;
}

/**
 * Complete melt without removing proofs - for fuse flow
 * Returns the proofs that need to be removed so caller can wait for tx confirmation
 */
export const completeMeltWithoutCleanup = async (quoteId: string, totalAmount: number): Promise<MeltWithoutCleanupResult> => {
  let changeProofs: CashuProof[] | null = null;
  let selectedProofs: CashuProof[] | null = null;

  try {
    logger.info('Completing melt without cleanup', { quoteId, totalAmount });

    const keyData = await getOrFetchKeys();
    const prepared = await prepareMeltSpend(totalAmount, keyData);
    selectedProofs = prepared.selectedProofs;

    // Melt tokens
    const result = await meltTokensAPI(quoteId, prepared.proofsToMelt, prepared.changeOutputs);
    assertMeltPaid(result);
    changeProofs = unblindMeltChange(result.change, prepared, keyData);

    logger.info('Melt completed without cleanup', {
      paid: result.paid,
      state: result.state,
      txid: getMeltTxid(result),
    });

    // Return the proofs that need to be removed later
    return {
      paid: isMeltPaid(result),
      txid: getMeltTxid(result),
      fee: getMeltFee(result),
      proofsToRemove: selectedProofs,
      changeProofs: changeProofs,
    };
  } catch (error: unknown) {
    logger.error('Failed to complete melt without cleanup', { error: (error as Error).message, hasSelectedProofs: !!selectedProofs });
    throw error;
  }
};

/**
 * Clean up proofs after melt transaction is confirmed
 */
export const cleanupMeltProofs = async (proofsToRemove: CashuProof[], changeProofs: CashuProof[] | null): Promise<void> => {
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
