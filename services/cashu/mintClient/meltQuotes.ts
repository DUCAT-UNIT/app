/**
 * Melt Quotes API - Redeem Cashu tokens → receive Runes
 */

import { getJSON, postJSON } from '../../../utils/apiClient';
import { logger } from '../../../utils/logger';
import { MINT_URL, CASHU_UNIT, RUNE_ID } from './mintConfig';
import { CashuProof } from '../p2pk';

export interface MeltQuote {
  quote: string;
  amount: number;
  fee_reserve: number;
  state: string;
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
 * Create a melt quote (redeem Cashu tokens → receive Runes)
 * @param address - Taproot address to send Runes to
 * @param amount - Amount in sats
 * @returns Quote with ID, amount, and fee
 */
export const createMeltQuote = async (address: string, amount: number): Promise<MeltQuote> => {
  try {
    logger.info('Creating melt quote', { address, amount });

    const quote = await postJSON<MeltQuote>(`${MINT_URL}/v1/melt/quote/unit`, {
      request: address,
      amount,
      unit: CASHU_UNIT,
      rune_id: RUNE_ID,
    }, {
      timeout: 10000,
      description: 'Create melt quote',
    });

    logger.info('Melt quote created', {
      quoteId: quote.quote,
      amount: quote.amount,
      fee: quote.fee_reserve
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
    const quote = await getJSON<MeltQuote>(`${MINT_URL}/v1/melt/quote/unit/${quoteId}`, {
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
 * Melt tokens (redeem for Runes)
 * @param quoteId - Melt quote ID
 * @param inputs - Proofs to burn
 * @returns Payment result with txid
 */
export const meltTokens = async (quoteId: string, inputs: CashuProof[]): Promise<MeltResponse> => {
  try {
    logger.info('Melting tokens', { quoteId, inputCount: inputs.length });

    const response = await postJSON<MeltResponse>(`${MINT_URL}/v1/melt/unit`, {
      quote: quoteId,
      inputs,
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
