/**
 * Mint Quotes API - Deposit Runes → receive Cashu tokens
 */

import { getJSON, postJSON } from '../../../utils/apiClient';
import { logger } from '../../../utils/logger';
import { MINT_URL, CASHU_UNIT, RUNE_ID } from './mintConfig';

/**
 * Create a mint quote (deposit Runes → receive Cashu tokens)
 * @param {number} amount - Amount in sats
 * @returns {Promise<Object>} Quote with ID, amount, and Taproot deposit address
 */
export const createMintQuote = async (amount) => {
  try {
    logger.info('Creating mint quote', { amount });

    const quote = await postJSON(`${MINT_URL}/v1/mint/quote/unit`, {
      amount,
      unit: CASHU_UNIT,
      rune_id: RUNE_ID,
    }, {
      timeout: 10000,
      description: 'Create mint quote',
    });

    logger.info('Mint quote created', {
      quoteId: quote.quote,
      depositAddress: quote.request
    });

    return quote;
  } catch (error) {
    logger.error('Failed to create mint quote', { error: error.message });
    throw error;
  }
};

/**
 * Check mint quote status
 * @param {string} quoteId - Quote ID
 * @returns {Promise<Object>} Quote status (UNPAID/PAID/ISSUED)
 */
export const checkMintQuote = async (quoteId) => {
  try {
    const quote = await getJSON(`${MINT_URL}/v1/mint/quote/unit/${quoteId}`, {
      timeout: 5000,
      description: 'Check mint quote',
    });
    return quote;
  } catch (error) {
    logger.error('Failed to check mint quote', { error: error.message, quoteId });
    throw error;
  }
};

/**
 * Mint tokens after deposit is confirmed
 * @param {string} quoteId - Quote ID
 * @param {Array} outputs - Blinded messages for amounts to mint
 * @returns {Promise<Object>} Blind signatures from mint
 */
export const mintTokens = async (quoteId, outputs) => {
  try {
    logger.info('Minting tokens', { quoteId, outputCount: outputs.length });

    const response = await postJSON(`${MINT_URL}/v1/mint/unit`, {
      quote: quoteId,
      outputs,
    }, {
      timeout: 10000,
      description: 'Mint tokens',
    });

    // Check if response contains an error
    if (response.error) {
      throw new Error(`Mint failed: ${response.error}`);
    }

    // Validate response has signatures
    if (!response.signatures || !Array.isArray(response.signatures)) {
      throw new Error('Invalid mint response: missing signatures');
    }

    logger.info('Tokens minted', { signatureCount: response.signatures.length });
    return response;
  } catch (error) {
    logger.error('Failed to mint tokens', { error: error.message, quoteId });
    throw error;
  }
};
