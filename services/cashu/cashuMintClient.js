import { getJSON, postJSON } from '../../utils/apiClient';
import { logger } from '../../utils/logger';

/**
 * Cashu Mint API Client
 * Communicates with the local mint server for Cashu e-cash operations
 */

// Mint server configuration
const MINT_URL = 'https://cashu-mint.ducatprotocol.com';

const CASHU_UNIT = 'sat'; // Using sats as unit
const RUNE_ID = '1527352:1'; // DUCAT•UNIT•RUNE (Mutinynet)

/**
 * Get mint information
 * @returns {Promise<Object>} Mint info including name, version, supported units
 */
export const getMintInfo = async () => {
  try {
    logger.info('Fetching mint info');
    const info = await getJSON(`${MINT_URL}/v1/info`, {
      timeout: 5000,
      description: 'Get mint info',
    });
    logger.info('Mint info fetched', { name: info.name, version: info.version });
    return info;
  } catch (error) {
    logger.error('Failed to fetch mint info', { error: error.message });
    throw error;
  }
};

/**
 * Get active keysets from mint
 * @returns {Promise<Object>} Keysets object with unit keys
 */
export const getKeysets = async () => {
  try {
    const keysets = await getJSON(`${MINT_URL}/v1/keysets`, {
      timeout: 5000,
      description: 'Get mint keysets',
    });
    return keysets;
  } catch (error) {
    logger.error('Failed to fetch keysets', { error: error.message });
    throw error;
  }
};

/**
 * Get keys for a specific keyset
 * @param {string} keysetId - Keyset ID
 * @returns {Promise<Object>} Public keys for the keyset
 */
export const getKeys = async (keysetId = null) => {
  try {
    const url = keysetId
      ? `${MINT_URL}/v1/keys/${keysetId}`
      : `${MINT_URL}/v1/keys`;

    const keys = await getJSON(url, {
      timeout: 5000,
      description: 'Get mint keys',
    });
    return keys;
  } catch (error) {
    logger.error('Failed to fetch keys', { error: error.message });
    throw error;
  }
};

/**
 * Create a mint quote (deposit Runes → receive Cashu tokens)
 * @param {number} amount - Amount in sats
 * @returns {Promise<Object>} Quote with ID, amount, and Taproot deposit address
 */
export const createMintQuote = async (amount) => {
  try {
    logger.info('Creating mint quote', { amount });

    const quote = await postJSON(`${MINT_URL}/v1/mint/quote/runes`, {
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
    const quote = await getJSON(`${MINT_URL}/v1/mint/quote/runes/${quoteId}`, {
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

    const response = await postJSON(`${MINT_URL}/v1/mint/runes`, {
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

/**
 * Swap tokens (e.g., for splitting/combining)
 * @param {Array} inputs - Proofs to swap
 * @param {Array} outputs - Blinded messages for new amounts
 * @returns {Promise<Object>} New blind signatures
 */
export const swapTokens = async (inputs, outputs) => {
  try {
    logger.info('Swapping tokens', {
      inputCount: inputs.length,
      outputCount: outputs.length
    });

    const response = await postJSON(`${MINT_URL}/v1/swap`, {
      inputs,
      outputs,
    }, {
      timeout: 10000,
      description: 'Swap tokens',
    });

    // Check if response contains an error
    if (response.error) {
      throw new Error(`Swap failed: ${response.error}`);
    }

    // Validate response has signatures
    if (!response.signatures || !Array.isArray(response.signatures)) {
      throw new Error('Invalid swap response: missing signatures');
    }

    logger.info('Tokens swapped', { signatureCount: response.signatures.length });
    return response;
  } catch (error) {
    logger.error('Failed to swap tokens', { error: error.message });
    throw error;
  }
};

/**
 * Create a melt quote (redeem Cashu tokens → receive Runes)
 * @param {string} address - Taproot address to send Runes to
 * @param {number} amount - Amount in sats
 * @returns {Promise<Object>} Quote with ID, amount, and fee
 */
export const createMeltQuote = async (address, amount) => {
  try {
    logger.info('Creating melt quote', { address, amount });

    const quote = await postJSON(`${MINT_URL}/v1/melt/quote/runes`, {
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
    const quote = await getJSON(`${MINT_URL}/v1/melt/quote/runes/${quoteId}`, {
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

    const response = await postJSON(`${MINT_URL}/v1/melt/runes`, {
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

/**
 * Check if proof has been spent
 * @param {Array} proofs - Proofs to check
 * @returns {Promise<Object>} Spendable status for each proof
 */
export const checkProofsSpent = async (proofs) => {
  try {
    const secrets = proofs.map((p) => p.secret);
    const response = await postJSON(`${MINT_URL}/v1/checkstate`, {
      Ys: secrets,
    }, {
      timeout: 5000,
      description: 'Check proof state',
    });
    return response;
  } catch (error) {
    logger.error('Failed to check proof state', { error: error.message });
    throw error;
  }
};

export default {
  MINT_URL,
  CASHU_UNIT,
  RUNE_ID,
  getMintInfo,
  getKeysets,
  getKeys,
  createMintQuote,
  checkMintQuote,
  mintTokens,
  swapTokens,
  createMeltQuote,
  checkMeltQuote,
  meltTokens,
  checkProofsSpent,
};
