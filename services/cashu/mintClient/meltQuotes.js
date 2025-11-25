/**
 * Melt Quotes API - Redeem Cashu tokens → receive Runes
 */

import { getJSON, postJSON } from '../../../utils/apiClient';
import { logger } from '../../../utils/logger';
import { MINT_URL, CASHU_UNIT, RUNE_ID } from './mintConfig';

/**
 * Create a melt quote (redeem Cashu tokens → receive Runes)
 * @param {string} address - Taproot address to send Runes to
 * @param {number} amount - Amount in sats
 * @returns {Promise<Object>} Quote with ID, amount, and fee
 */
export const createMeltQuote = async (address, amount) => {
  try {
    logger.info('Creating melt quote', { address, amount });

    const quote = await postJSON(`${MINT_URL}/v1/melt/quote/unit`, {
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
  } catch (error) {
    logger.error('Failed to create melt quote', { error: error.message });
    throw error;
  }
};

/**
 * Check melt quote status
 * @param {string} quoteId - Quote ID
 * @returns {Promise<Object>} Quote status
 */
export const checkMeltQuote = async (quoteId) => {
  try {
    const quote = await getJSON(`${MINT_URL}/v1/melt/quote/unit/${quoteId}`, {
      timeout: 5000,
      description: 'Check melt quote',
    });
    return quote;
  } catch (error) {
    logger.error('Failed to check melt quote', { error: error.message, quoteId });
    throw error;
  }
};

/**
 * Melt tokens (redeem for Runes)
 * @param {string} quoteId - Melt quote ID
 * @param {Array} inputs - Proofs to burn
 * @returns {Promise<Object>} Payment result with txid
 */
export const meltTokens = async (quoteId, inputs) => {
  try {
    logger.info('Melting tokens', { quoteId, inputCount: inputs.length });

    const response = await postJSON(`${MINT_URL}/v1/melt/unit`, {
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
  } catch (error) {
    logger.error('Failed to melt tokens', { error: error.message, quoteId });
    throw error;
  }
};
