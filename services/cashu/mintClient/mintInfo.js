/**
 * Mint Info API - Mint information and keys
 */

import { getJSON } from '../../../utils/apiClient';
import { logger } from '../../../utils/logger';
import { MINT_URL } from './mintConfig';

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
