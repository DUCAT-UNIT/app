/**
 * Cashu Mint Operations
 * Handles minting new tokens from Bitcoin deposits
 */

import { logger } from '../../../utils/logger';
import {
  createMintQuote,
  checkMintQuote,
  mintTokens as mintTokensAPI,
  MintQuote,
} from '../cashuMintClient';
import { createBlindedOutputs, unblindSignatures, splitAmount, BlindedOutput } from '../crypto';
import { getOrFetchKeys } from '../cashuBalanceService';
import { addProofs } from '../cashuProofManager';
import { CashuProof } from '../crypto';

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
    const quote: MintQuote = await createMintQuote(amount);

    logger.info('Mint quote received from mint', {
      quoteId: quote.quote,
      requestedAmount: amount,
      quoteAmount: quote.amount,
      depositAddress: quote.request,
    });

    return {
      quoteId: quote.quote,
      amount: quote.amount,
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

    const keyData = await getOrFetchKeys();

    // Extract keys from keyData
    let keys: Record<string, string>;
    let keysetId: string;
    if (keyData.keysets && keyData.keysets.length > 0) {
      // New format with keyset array
      keysetId = keyData.keysets[0].id;
      keys = keyData.keysets[0].keys;
    } else if (keyData.keys) {
      // Legacy format
      keys = keyData.keys;
      keysetId = '';
    } else {
      // No keysets available
      throw new Error('No keysets available from mint');
    }

    // Split amount into denominations
    const amounts = splitAmount(amount);

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
    const response = await mintTokensAPI(quoteId, outputs);

    logger.info('Received signatures from mint', {
      signatureCount: response.signatures.length,
    });

    // Unblind signatures to create proofs
    const proofs = unblindSignatures(
      response.signatures,
      blindingData,
      keys,
      response.signatures[0]?.id || keysetId
    );

    // Add proofs to wallet
    await addProofs(proofs);

    logger.info('Mint completed', { proofCount: proofs.length });

    return proofs;
  } catch (error: unknown) {
    logger.error('Failed to complete mint', { error: (error as Error).message });
    throw error;
  }
};
