/**
 * Cashu Mint Operations
 * Handles minting new tokens from Bitcoin deposits
 */

import { logger } from '../../../utils/logger';
import {
  resolveResponseSignatureKeysetForUnit,
  selectActiveCashuKeyset,
} from '../cashuKeysetUtils';
import { getMintQuoteSigningKey, signMintQuoteOutputs } from '../cashuQuoteSigner';
import { getOrFetchKeys } from '../cashuBalanceService';
import {
  checkMintQuote,
  createMintQuote,
  MintQuote,
  mintTokens as mintTokensAPI,
} from '../cashuMintClient';
import {
  ensureMintQuoteClaimCanBePersisted,
  persistMintQuoteClaim,
  removeMintQuote,
  saveMintQuote,
  updateMintQuoteState,
} from '../cashuMintQuoteRecovery';
import {
  clearProofRecoveryRecord,
  persistProofRecoveryRecord,
} from '../cashuProofRecoveryQueue';
import { addProofs } from '../cashuProofManager';
import { CashuProof, createBlindedOutputs, splitAmount, sumProofs, unblindSignatures } from '../crypto';
import { deriveMintQuoteState } from '../mintClient/mintQuotes';
import { DEFAULT_CASHU_UNIT, normalizeCashuUnit, type CashuUnit } from '../cashuUnits';
import { requireCashuOperationAccount } from './cashuAccountGuard';

export interface MintQuoteResult {
  quoteId: string;
  amount?: number;
  depositAddress: string;
  expiry?: number;
  state: string;
  unit?: CashuUnit;
}

const isDefaultCashuUnit = (unit: CashuUnit): boolean => unit === DEFAULT_CASHU_UNIT;

/**
 * Request a mint quote (deposit address)
 * Step 1: Get deposit address from mint
 */
export const requestMint = async (
  amount: number,
  unit: CashuUnit = DEFAULT_CASHU_UNIT
): Promise<MintQuoteResult> => {
  try {
    logger.info('Requesting mint', { amount, type: typeof amount, unit });
    requireCashuOperationAccount('Cashu mint quote request');
    const signingKey = await getMintQuoteSigningKey();
    const quote: MintQuote = isDefaultCashuUnit(unit)
      ? await createMintQuote(signingKey.pubkey)
      : await createMintQuote(signingKey.pubkey, unit);

    logger.info('Mint quote received from mint', {
      quoteId: quote.quote,
      requestedAmount: amount,
      quoteAmount: quote.amount,
      depositAddress: quote.request,
    });

    // Persist the quote for recovery in case of crash
    if (quote.amount !== undefined) {
      await saveMintQuote({
        quoteId: quote.quote,
        amount: quote.amount,
        depositAddress: quote.request,
        unit,
      });
    } else {
      await saveMintQuote({
        quoteId: quote.quote,
        amount,
        depositAddress: quote.request,
        unit,
      });
    }

    return {
      quoteId: quote.quote,
      amount: quote.amount ?? amount,
      depositAddress: quote.request, // Taproot address
      expiry: quote.expiry,
      state: quote.state ?? 'UNPAID',
      ...(isDefaultCashuUnit(unit) ? {} : { unit }),
    };
  } catch (error: unknown) {
    logger.error('Failed to request mint', { error: (error as Error).message });
    throw error;
  }
};

export interface MintStatusResult {
  quoteId: string;
  state: string;
  paid: boolean;
  amountPaid?: number;
  amountIssued?: number;
  availableAmount: number;
}

/**
 * Check mint quote status
 * Step 2: Poll to check if payment received
 */
export const checkMintStatus = async (quoteId: string): Promise<MintStatusResult> => {
  try {
    const quote: MintQuote = await checkMintQuote(quoteId);

    logger.info('Mint quote status checked', {
      quoteId: quote.quote,
      state: quote.state,
      amountPaid: quote.amount_paid,
      amountIssued: quote.amount_issued,
      fullQuote: quote,
    });

    const amountPaid = quote.amount_paid;
    const amountIssued = quote.amount_issued;
    const availableAmount = Math.max(0, (amountPaid ?? 0) - (amountIssued ?? 0));
    const state = deriveMintQuoteState(quote);

    return {
      quoteId: quote.quote,
      state,
      paid: availableAmount > 0 || state === 'PAID' || state === 'ISSUED' || quote.paid === true,
      amountPaid,
      amountIssued,
      availableAmount,
    };
  } catch (error: unknown) {
    logger.error('Failed to check mint status', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Complete mint (claim tokens)
 * Step 3: Once paid, claim tokens from mint
 */
export const completeMint = async (
  quoteId: string,
  amount: number,
  unit: CashuUnit = DEFAULT_CASHU_UNIT
): Promise<CashuProof[]> => {
  let claimPersisted = false;

  try {
    logger.info('Completing mint', { quoteId, amount, unit });
    requireCashuOperationAccount('Cashu mint claim');

    // Mark quote as pending to prevent double-claim attempts
    await updateMintQuoteState(quoteId, 'PENDING');

    // Force fresh keys — stale cached keys from a previous mint instance cause unblinding failures
    const keyData = await getOrFetchKeys(true);
    const paidQuote = await checkMintQuote(quoteId);
    if (paidQuote.unit !== undefined && paidQuote.unit !== null) {
      const quoteUnit = normalizeCashuUnit(paidQuote.unit);
      if (quoteUnit !== unit) {
        throw new Error(`Mint quote unit mismatch: expected ${unit} but mint returned ${quoteUnit}`);
      }
    }
    const amountPaid = paidQuote.amount_paid ?? paidQuote.amount ?? amount;
    const amountIssued = paidQuote.amount_issued ?? 0;
    const availableAmount = amountPaid - amountIssued;

    if (availableAmount <= 0) {
      throw new Error(`No available mint amount for quote ${quoteId}`);
    }

    const unitKeyset = selectActiveCashuKeyset(keyData, unit);
    const keysetId = unitKeyset.id;
    const keys = unitKeyset.keys!;

    // Split amount into denominations
    const amounts = splitAmount(availableAmount);

    logger.info('Creating blinded outputs', {
      amounts,
      keysetId,
    });

    // Create blinded outputs
    const { outputs, blindingData } = await createBlindedOutputs(amounts, keysetId);

    logger.info('Requesting mint signatures', {
      quoteId,
      outputCount: outputs.length,
    });

    // Get signatures from mint
    const signingKey = await getMintQuoteSigningKey();
    if (paidQuote.pubkey && paidQuote.pubkey !== signingKey.pubkey) {
      throw new Error('Mint quote pubkey does not match wallet signing key');
    }
    await ensureMintQuoteClaimCanBePersisted(quoteId);
    const signature = signMintQuoteOutputs(quoteId, outputs, signingKey.privateKey);

    // Persist the blinded outputs before asking the mint to sign them. If the
    // app dies after mintTokensAPI succeeds but before its response is stored,
    // recovery can restore the signatures from these exact outputs.
    await persistMintQuoteClaim(quoteId, {
      amount: availableAmount,
      blindingData,
      keys,
      keysetId,
      signedKeysetId: keysetId,
    });
    claimPersisted = true;

    const response = await mintTokensAPI(quoteId, outputs, signature);

    logger.info('Received signatures from mint', {
      signatureCount: response.signatures.length,
    });

    const { keysetId: signedKeysetId, keys: unblindKeys } = resolveResponseSignatureKeysetForUnit(
      response.signatures,
      keyData,
      unitKeyset,
      unit,
      `Mint ${unit} claim`
    );

    try {
      await persistMintQuoteClaim(quoteId, {
        amount: availableAmount,
        signatures: response.signatures,
        blindingData,
        keys: unblindKeys,
        keysetId,
        signedKeysetId,
      });
      claimPersisted = true;
    } catch (persistError) {
      logger.error('Failed to persist mint claim after signatures; saving proofs immediately', {
        error: persistError instanceof Error ? persistError.message : String(persistError),
      });
      const proofs = unblindSignatures(
        response.signatures,
        blindingData,
        unblindKeys,
        signedKeysetId
      );
      const proofTotal = sumProofs(proofs);
      if (proofTotal !== availableAmount) {
        throw new Error(`Mint verification failed: expected ${availableAmount} but received ${proofTotal}`);
      }
      let recoveryKey: string | null = null;
      try {
        recoveryKey = isDefaultCashuUnit(unit)
          ? await persistProofRecoveryRecord(
              proofs,
              availableAmount,
              'mint_claim',
              persistError instanceof Error ? persistError.message : String(persistError)
            )
          : await persistProofRecoveryRecord(
              proofs,
              availableAmount,
              'mint_claim',
              persistError instanceof Error ? persistError.message : String(persistError),
              unit
            );
      } catch (recoveryError) {
        logger.error('Failed to persist mint claim proofs in recovery queue', {
          quoteId,
          error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
          proofCount: proofs.length,
          amount: availableAmount,
        });
      }
      if (isDefaultCashuUnit(unit)) {
        await addProofs(proofs);
      } else {
        await addProofs(proofs, true, unit);
      }
      if (recoveryKey) {
        await clearProofRecoveryRecord(recoveryKey);
      }
      await removeMintQuote(quoteId);
      return proofs;
    }

    // Unblind signatures to create proofs only after the claim response is durable.
    const proofs = unblindSignatures(
      response.signatures,
      blindingData,
      unblindKeys,
      signedKeysetId
    );
    const proofTotal = sumProofs(proofs);
    if (proofTotal !== availableAmount) {
      throw new Error(`Mint verification failed: expected ${availableAmount} but received ${proofTotal}`);
    }

    // Add proofs to wallet
    if (isDefaultCashuUnit(unit)) {
      await addProofs(proofs);
    } else {
      await addProofs(proofs, true, unit);
    }

    // Remove the quote from recovery storage after successful claim
    await removeMintQuote(quoteId);

    logger.info('Mint completed', { proofCount: proofs.length });

    return proofs;
  } catch (error: unknown) {
    logger.error('Failed to complete mint', { error: (error as Error).message });
    // If the mint already returned signatures, retrying mintTokens can fail as
    // already issued. Leave the persisted claim for recovery instead.
    await updateMintQuoteState(quoteId, claimPersisted ? 'PENDING' : 'PAID');
    throw error;
  }
};
