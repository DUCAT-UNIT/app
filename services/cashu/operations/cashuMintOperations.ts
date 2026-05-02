/**
 * Cashu Mint Operations
 * Handles minting new tokens from Bitcoin deposits
 */

import { logger } from '../../../utils/logger';
import { selectActiveUnitKeyset, findKeysetById } from '../cashuKeysetUtils';
import { getMintQuoteSigningKey, signMintQuoteOutputs } from '../cashuQuoteSigner';
import { getOrFetchKeys } from '../cashuBalanceService';
import {
checkMintQuote,
createMintQuote,
MintQuote,
mintTokens as mintTokensAPI,
} from '../cashuMintClient';
import { removeMintQuote,saveMintQuote,updateMintQuoteState } from '../cashuMintQuoteRecovery';
import { addProofs } from '../cashuProofManager';
import { CashuProof,createBlindedOutputs,splitAmount,unblindSignatures } from '../crypto';

export interface MintQuoteResult {
  quoteId: string;
  amount?: number;
  depositAddress: string;
  expiry?: number;
  state: string;
}

/**
 * Request a mint quote (deposit address)
 * Step 1: Get deposit address from mint
 */
export const requestMint = async (amount: number): Promise<MintQuoteResult> => {
  try {
    logger.info('Requesting mint', { amount, type: typeof amount });
    const signingKey = await getMintQuoteSigningKey();
    const quote: MintQuote = await createMintQuote(signingKey.pubkey);

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
      });
    } else {
      await saveMintQuote({
        quoteId: quote.quote,
        amount,
        depositAddress: quote.request,
      });
    }

    return {
      quoteId: quote.quote,
      amount: quote.amount ?? amount,
      depositAddress: quote.request, // Taproot address
      expiry: quote.expiry,
      state: quote.state,
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
      fullQuote: quote
    });

    return {
      quoteId: quote.quote,
      state: quote.state,
      paid: quote.state === 'PAID' || quote.state === 'ISSUED',
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
export const completeMint = async (quoteId: string, amount: number): Promise<CashuProof[]> => {
  try {
    logger.info('Completing mint', { quoteId, amount });

    // Mark quote as pending to prevent double-claim attempts
    await updateMintQuoteState(quoteId, 'PENDING');

    // Force fresh keys — stale cached keys from a previous mint instance cause unblinding failures
    const keyData = await getOrFetchKeys(true);
    const paidQuote = await checkMintQuote(quoteId);
    const amountPaid = paidQuote.amount_paid ?? paidQuote.amount ?? amount;
    const amountIssued = paidQuote.amount_issued ?? 0;
    const availableAmount = amountPaid - amountIssued;

    if (availableAmount <= 0) {
      throw new Error(`No available mint amount for quote ${quoteId}`);
    }

    const unitKeyset = selectActiveUnitKeyset(keyData);
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
    const signature = signMintQuoteOutputs(quoteId, outputs, signingKey.privateKey);
    const response = await mintTokensAPI(quoteId, outputs, signature);

    logger.info('Received signatures from mint', {
      signatureCount: response.signatures.length,
    });

    // Determine which keyset the mint actually signed with
    const signedKeysetId = response.signatures[0]?.id || keysetId;
    let unblindKeys = keys;

    // If the mint signed with a different keyset than we selected, look up the correct keys
    if (signedKeysetId && signedKeysetId !== keysetId && keyData.keysets) {
      const signedKeyset = findKeysetById(keyData, signedKeysetId);
      if (signedKeyset) {
        logger.info('Mint signed with different keyset, switching keys', {
          requested: keysetId,
          signed: signedKeysetId,
        });
        unblindKeys = signedKeyset.keys!;
      }
    }

    // Unblind signatures to create proofs
    const proofs = unblindSignatures(
      response.signatures,
      blindingData,
      unblindKeys,
      signedKeysetId
    );

    // Add proofs to wallet
    await addProofs(proofs);

    // Remove the quote from recovery storage after successful claim
    await removeMintQuote(quoteId);

    logger.info('Mint completed', { proofCount: proofs.length });

    return proofs;
  } catch (error: unknown) {
    logger.error('Failed to complete mint', { error: (error as Error).message });
    // Reset state so recovery can try again
    await updateMintQuoteState(quoteId, 'PAID');
    throw error;
  }
};
