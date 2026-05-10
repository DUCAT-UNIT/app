/**
 * Mint Info API - Mint information and keys
 */

import { getJSON } from '../../../utils/apiClient';
import { logger } from '../../../utils/logger';
import type { CashuAmountLike } from '../cashuTsCompat';
import { CASHU_UNIT_UNIT, type CashuUnit } from '../cashuUnits';
import { MINT_URL } from './mintConfig';

export interface MintInfo {
  name?: string;
  version?: string;
  nuts?: Record<
    string,
    {
      methods?: Array<{
        method: string;
        unit: string;
        min_amount?: CashuAmountLike;
        max_amount?: CashuAmountLike;
      }>;
      supported?: boolean;
    }
  >;
}

let cachedDleqSupport: boolean | null = null;

export interface Keysets {
  keysets: Array<{
    id: string;
    unit: string;
    active?: boolean;
    input_fee_ppk?: CashuAmountLike | null;
    final_expiry?: number | null;
  }>;
}

export interface MintKeyset {
  id: string;
  unit: string;
  active?: boolean;
  input_fee_ppk?: CashuAmountLike | null;
  final_expiry?: number | null;
  keys?: Record<number | string, string>;
}

export interface MintKeys {
  keysets: MintKeyset[];
}

export const mintSupportsOnchainUnit = (info: MintInfo): boolean =>
  mintSupportsOnchainCashuUnit(info, CASHU_UNIT_UNIT);

export const mintSupportsOnchainCashuUnit = (info: MintInfo, unit: CashuUnit): boolean =>
  !!info.nuts?.['4']?.methods?.some(
    (method) => method.method === 'onchain' && method.unit === unit
  );

export const mintSupportsNut12Dleq = (info: MintInfo): boolean => {
  const nut12 = info.nuts?.['12'];
  return !!nut12 && nut12.supported !== false;
};

export const mintRequiresDleqProofs = async (): Promise<boolean> => {
  if (cachedDleqSupport !== null) {
    return cachedDleqSupport;
  }

  const info = await getMintInfo();
  cachedDleqSupport = mintSupportsNut12Dleq(info);
  return cachedDleqSupport;
};

export const assertOnchainUnitMintSupport = async (): Promise<void> => {
  await assertOnchainCashuMintSupport(CASHU_UNIT_UNIT);
};

export const assertOnchainCashuMintSupport = async (unit: CashuUnit): Promise<void> => {
  const info = await getMintInfo();
  if (!mintSupportsOnchainCashuUnit(info, unit)) {
    throw new Error(`Mint does not advertise onchain/${unit} support in nuts["4"].methods`);
  }
};

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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
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
    const url = keysetId ? `${MINT_URL}/v1/keys/${keysetId}` : `${MINT_URL}/v1/keys`;

    const keys = await getJSON<MintKeys>(url, {
      timeout: 5000,
      description: 'Get mint keys',
    });
    return keys;
  } catch (error: unknown) {
    logger.error('Failed to fetch keys', { error: (error as Error).message });
    throw error;
  }
};
