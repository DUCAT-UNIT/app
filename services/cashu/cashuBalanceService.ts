import * as SecureStore from 'expo-secure-store';
import { logger } from '../../utils/logger';
import { getKeys, MintKeys } from './cashuMintClient';
import { sumProofs } from './crypto';
import { isP2PKSecret } from './p2pk';
import { loadProofs, loadProofsPartial } from './cashuProofManager';

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

/**
 * Get cached keyset or fetch from mint
 * @returns Mint public keys
 */
export const getOrFetchKeys = async (): Promise<MintKeys> => {
  try {
    // Try to load from cache
    const cached = await SecureStore.getItemAsync(KEYSETS_KEY);
    if (cached) {
      try {
        const parsed: CachedKeysets = JSON.parse(cached);
        // Check if it's the new format
        if (parsed.keysetData && parsed.timestamp) {
          // Cache for 1 hour
          if (Date.now() - parsed.timestamp < 60 * 60 * 1000) {
            return parsed.keysetData;
          }
        }
        // Old format or expired - will refetch below
      } catch (parseError) {
        logger.warn('Failed to parse cached keys, will refetch', { error: (parseError as Error).message });
      }
    }

    // Fetch fresh keys
    const keysetData = await getKeys();

    // Cache for next time
    await SecureStore.setItemAsync(
      KEYSETS_KEY,
      JSON.stringify({ keysetData, timestamp: Date.now() })
    );

    return keysetData;
  } catch (error) {
    logger.error('Failed to get keys', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Get current balance (fast initial load with first 25 proofs, then full load)
 * @param fullLoad - If false, only load first 25 proofs for quick estimate
 * @returns Total balance in sats
 */
export const getBalance = async (fullLoad = true): Promise<number> => {
  // For quick initial load, only load first 25 proofs
  const proofs = fullLoad ? await loadProofs() : await loadProofsPartial(25);

  // Filter out P2PK locked proofs - they're not spendable balance
  const spendableProofs = proofs.filter(p => !isP2PKSecret(p.secret));

  logger.info('Balance calculation', {
    totalProofs: proofs.length,
    spendableProofs: spendableProofs.length,
    lockedProofs: proofs.length - spendableProofs.length,
    fullLoad,
  });

  return sumProofs(spendableProofs);
};
