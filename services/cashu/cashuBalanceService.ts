import { logger } from '../../utils/logger';
import { getPreferenceItem, setPreferenceItem } from '../storagePolicy';
import { getKeys, MintKeys } from './cashuMintClient';
import { sumProofs } from './crypto';
import { isP2PKSecret } from './p2pk';
import { loadProofs, loadProofsPartial } from './cashuProofManager';
import { CASHU_UNITS, DEFAULT_CASHU_UNIT, type CashuUnit } from './cashuUnits';

/**
 * Cashu Balance Service
 * Handles balance calculations and keyset management
 * Extracted from cashuWalletService.js for better separation of concerns
 */

const KEYSETS_KEY = 'cashu_keysets';

interface CachedKeysets {
  keysetData: MintKeys;
  timestamp: number;
}

const hasActiveKeysForEverySupportedUnit = (keysetData: MintKeys): boolean =>
  CASHU_UNITS.every((unit) =>
    keysetData.keysets?.some(
      (keyset) => keyset.unit === unit && keyset.active !== false && keyset.keys
    )
  );

/**
 * Get cached keyset or fetch from mint
 * @returns Mint public keys
 */
export const getOrFetchKeys = async (forceRefresh = false): Promise<MintKeys> => {
  try {
    // Try to load from cache (skip if force refresh)
    if (!forceRefresh) {
      const cached = await getPreferenceItem(KEYSETS_KEY);
      if (cached) {
        try {
          const parsed: CachedKeysets = JSON.parse(cached);
          // Check if it's the new format
          if (parsed.keysetData && parsed.timestamp) {
            // Cache for 1 hour
            if (
              Date.now() - parsed.timestamp < 60 * 60 * 1000 &&
              hasActiveKeysForEverySupportedUnit(parsed.keysetData)
            ) {
              return parsed.keysetData;
            }
          }
          // Old format or expired - will refetch below
        } catch (parseError) {
          logger.warn('Failed to parse cached keys, will refetch', { error: (parseError as Error).message });
        }
      }
    }

    // Fetch fresh keys
    const keysetData = await getKeys();

    // Cache for next time
    await setPreferenceItem(
      KEYSETS_KEY,
      JSON.stringify({ keysetData, timestamp: Date.now() })
    );

    return keysetData;
  } catch (error: unknown) {
    logger.error('Failed to get keys', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Get current balance (fast initial load with first 25 proofs, then full load)
 * @param fullLoad - If false, only load first 25 proofs for quick estimate
 * @returns Total balance in Ducat UNIT smallest units
 */
export const getBalance = async (
  fullLoad = true,
  unit: CashuUnit = DEFAULT_CASHU_UNIT
): Promise<number> => {
  // For quick initial load, only load first 25 proofs
  const proofs = unit === DEFAULT_CASHU_UNIT
    ? (fullLoad ? await loadProofs() : await loadProofsPartial(25))
    : (fullLoad ? await loadProofs(unit) : await loadProofsPartial(25, unit));

  // Filter out P2PK locked proofs - they're not spendable balance
  const spendableProofs = proofs.filter(p => !isP2PKSecret(p.secret));

  logger.info('Balance calculation', {
    totalProofs: proofs.length,
    spendableProofs: spendableProofs.length,
    lockedProofs: proofs.length - spendableProofs.length,
    fullLoad,
    unit,
  });

  return sumProofs(spendableProofs);
};
