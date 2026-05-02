/**
 * Melt Quotes API - redeem Cashu UNIT tokens to an on-chain UNIT Rune transfer
 */

import { getJSON, postJSON } from '../../../utils/apiClient';
import { logger } from '../../../utils/logger';
import { MINT_URL, CASHU_UNIT, RUNE_ID } from './mintConfig';
import { CashuProof } from '../p2pk';

export interface MeltQuote {
  quote: string;
  amount: number;
  fee?: number;
  fee_reserve?: number;
  state?: string;
  paid?: boolean;
  expiry?: number;
}

export interface MeltResponse {
  paid: boolean;
  payment_preimage: string;
  fee_paid?: number;
  change?: Array<{ C_: string; id?: string; amount?: number }>;
}

/**
 * Create a melt quote for the advertised onchain/unit Cashu method.
 * @param address - Destination Bitcoin address
 * @param amount - Amount in UNIT smallest units
 * @returns Quote with ID, amount, and fee
 */
export const createMeltQuote = async (address: string, amount: number): Promise<MeltQuote> => {
  try {
    logger.info('Creating melt quote', { address, amount });

    const response = await postJSON<MeltQuote[] | { quotes?: MeltQuote[] } | MeltQuote>(`${MINT_URL}/v1/melt/quote/onchain`, {
      request: address,
      amount,
      unit: CASHU_UNIT,
      rune_id: RUNE_ID,
    }, {
      timeout: 10000,
      description: 'Create melt quote',
    });

    const responseWithQuotes = response as { quotes?: MeltQuote[] };
    const quotes = Array.isArray(response)
      ? response
      : Array.isArray(responseWithQuotes.quotes)
        ? responseWithQuotes.quotes
        : [response as MeltQuote];
    if (quotes.length === 0) {
      throw new Error('Mint returned no melt quote options');
    }

    const quote = [...quotes].sort(
      (a, b) => (a.amount + (a.fee ?? a.fee_reserve ?? 0)) - (b.amount + (b.fee ?? b.fee_reserve ?? 0))
    )[0];

    logger.info('Melt quote created', {
      quoteId: quote.quote,
      amount: quote.amount,
      fee: quote.fee ?? quote.fee_reserve ?? 0
    });

    return quote;
  } catch (error: unknown) {
    logger.error('Failed to create melt quote', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Check melt quote status
 * @param quoteId - Quote ID
 * @returns Quote status
 */
export const checkMeltQuote = async (quoteId: string): Promise<MeltQuote> => {
  try {
    const quote = await getJSON<MeltQuote>(`${MINT_URL}/v1/melt/quote/onchain/${quoteId}`, {
      timeout: 5000,
      description: 'Check melt quote',
    });
    return quote;
  } catch (error: unknown) {
    logger.error('Failed to check melt quote', { error: (error as Error).message, quoteId });
    throw error;
  }
};

/**
 * Melt tokens through the advertised onchain/unit Cashu method.
 * @param quoteId - Melt quote ID
 * @param inputs - Proofs to burn
 * @returns Payment result with txid
 */
export const meltTokens = async (
  quoteId: string,
  inputs: CashuProof[],
  outputs: Array<{ amount: number; B_: string; id?: string }> = []
): Promise<MeltResponse> => {
  try {
    logger.info('Melting tokens', { quoteId, inputCount: inputs.length, outputCount: outputs.length });

    const response = await postJSON<MeltResponse>(`${MINT_URL}/v1/melt/onchain`, {
      quote: quoteId,
      inputs,
      outputs,
    }, {
      timeout: 15000,
      description: 'Melt tokens',
    });

    logger.info('Tokens melted', {
      paid: response.paid,
      txid: response.payment_preimage
    });

    return response;
  } catch (error: unknown) {
    logger.error('Failed to melt tokens', { error: (error as Error).message, quoteId });
    throw error;
  }
};
