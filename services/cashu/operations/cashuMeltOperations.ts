/**
 * Cashu Melt Operations
 * Handles redeeming Cashu UNIT tokens through the onchain/unit mint method.
 */

import { logger } from '../../../utils/logger';
import {
  findKeysetById,
  selectActiveUnitKeyset,
  selectProofsForAmountIncludingFees,
} from '../cashuKeysetUtils';
import {
  createMeltQuote,
  meltTokens as meltTokensAPI,
  MeltQuote,
} from '../cashuMintClient';
import type { MintKeys } from '../cashuMintClient';
import {
  createBlindedOutputs,
  unblindSignatures,
  splitAmount,
  CashuProof,
} from '../crypto';
import { getOrFetchKeys, getBalance } from '../cashuBalanceService';
import { loadProofs, removeProofs, addProofs } from '../cashuProofManager';
import { normalizeOptionalCashuAmount, type CashuAmountLike } from '../cashuTsCompat';

export interface MeltQuoteResult {
  quoteId: string;
  amount: number;
  fee: number;
  total: number;
}

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

  logger.info('Proofs loaded for melt', {
    count: allProofs.length,
    proofIds: allProofs.map(p => ({ amount: p.amount, id: p.id, secretPreview: p.secret?.substring(0, 8) }))
  });

  const {
    selectedProofs,
    selectedAmount,
    inputFees,
  } = selectProofsForAmountIncludingFees(allProofs, baseAmount, keyData);

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
      txid: result.payment_preimage,
      newBalance,
    });

    return {
      paid: result.paid,
      txid: result.payment_preimage,
      fee: normalizeOptionalCashuAmount(result.fee_paid, 'melt fee_paid') || 0,
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
    changeProofs = unblindMeltChange(result.change, prepared, keyData);

    logger.info('Melt completed without cleanup', {
      paid: result.paid,
      txid: result.payment_preimage,
    });

    // Return the proofs that need to be removed later
    return {
      paid: result.paid,
      txid: result.payment_preimage,
      fee: normalizeOptionalCashuAmount(result.fee_paid, 'melt fee_paid') || 0,
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
