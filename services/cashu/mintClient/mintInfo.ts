/**
 * Mint Info API - Mint information and keys
 */

import { getJSON } from '../../../utils/apiClient';
import { logger } from '../../../utils/logger';
import { MINT_URL } from './mintConfig';

export interface MintInfo {
  name: string;
  version: string;
  [key: string]: any;
}

export interface Keysets {
  keysets: string[];
  [key: string]: any;
}

export interface MintKeys {
  keysets: Array<{
    id: string;
    unit: string;
    keys: Record<number, string>;
  }>;
  [key: string]: any;
}

/**
 * Get mint information
 * @returns Mint info including name, version, supported units
 */
export const getMintInfo = async (): Promise<MintInfo> => {
  try {
    logger.info('Fetching mint info');
    const info = await getJSON<MintInfo>(`${MINT_URL}/v1/info`, {
      timeout: 5000,
      description: 'Get mint info',
    });
    logger.info('Mint info fetched', { name: info.name, version: info.version });
    return info;
  } catch (error) {
    logger.error('Failed to fetch mint info', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Get active keysets from mint
 * @returns Keysets object with unit keys
 */
export const getKeysets = async (): Promise<Keysets> => {
  try {
    const keysets = await getJSON<Keysets>(`${MINT_URL}/v1/keysets`, {
      timeout: 5000,
      description: 'Get mint keysets',
    });
    return keysets;
  } catch (error) {
    logger.error('Failed to fetch keysets', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Get keys for a specific keyset
 * @param keysetId - Keyset ID
 * @returns Public keys for the keyset
 */
export const getKeys = async (keysetId: string | null = null): Promise<MintKeys> => {
  try {
    const url = keysetId
      ? `${MINT_URL}/v1/keys/${keysetId}`
      : `${MINT_URL}/v1/keys`;

    const keys = await getJSON<MintKeys>(url, {
      timeout: 5000,
      description: 'Get mint keys',
    });
    return keys;
  } catch (error) {
    logger.error('Failed to fetch keys', { error: (error as Error).message });
    throw error;
  }
};
