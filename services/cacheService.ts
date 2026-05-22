/**
 * Cache Service
 * Clear all app cache except for sensitive data (mnemonic, PIN, etc.)
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import { SECURE_KEYS } from '../utils/constants';
import { deletePreferenceItem } from './storagePolicy';

export interface CacheClearSummary {
  secureStoreCleared: number;
  asyncStorageCleared: number;
  cashuProofsCleared: number;
  derivedKeysCleared: number;
  errors: string[];
}

// Keys to PRESERVE (never delete)
const PROTECTED_KEYS = [
  SECURE_KEYS.MNEMONIC,
  SECURE_KEYS.PIN,
  SECURE_KEYS.PIN_SALT,
  SECURE_KEYS.BIOMETRIC_ENABLED,
  'onboarding_complete', // Preserve onboarding state
  // Legacy key names for backward compatibility
  'mnemonic',
  'pin_hash',
];

// Known SecureStore keys that can be safely cleared
const CLEARABLE_SECURE_STORE_KEYS = [
  // P2PK cache (all versions)
  'p2pk_taproot_address_v3',
  'p2pk_private_key_v3',
  'p2pk_taproot_address_v2',
  'p2pk_private_key_v2',
  'p2pk_taproot_address',
  'p2pk_private_key',

  // Cashu keysets and non-fund token processing cache
  'cashu_keysets',
  'processed_cashu_tokens',

  // Transaction cache
  'pending_transactions',

  // Settings cache
  'app_settings',
  'display_preferences',

  // Current account (will be re-derived on next load)
  'current_account',
];

const SAFETY_ASYNC_STORAGE_KEYS = new Set([
  // Crash/retry journals and checkpoints
  'operation-journal',
  'evm-transaction-checkpoints',
  'vault-settlement',
  '@ducat/vault_settlement_history_v1',

  // In-flight Turbo Cashu and liquidation recovery
  'turbo_processing_state',
  'liquidation_pending_swap_broadcasts_v1',

  // In-progress vault creation
  'vault-creation',

  // Transaction history/dedupe registries
  '@ducat/swap_txids',
  '@ducat/swap_txids_migrated_v2',
  '@ducat/liquidation_txids',
]);

const SAFETY_ASYNC_STORAGE_PREFIXES = ['pending_txs_', 'spent_utxos_', 'pending_vault_tx_'];

const isProtectedAsyncStorageKey = (key: string): boolean => {
  if (PROTECTED_KEYS.includes(key)) return true;
  if (SAFETY_ASYNC_STORAGE_KEYS.has(key)) return true;
  return SAFETY_ASYNC_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
};

/**
 * Clear all app cache except for protected keys (mnemonic, PIN, etc.)
 * AGGRESSIVE MODE: Clears everything that could be corrupted
 * @returns Summary of what was cleared
 */
export const clearAppCache = async (): Promise<CacheClearSummary> => {
  const summary: CacheClearSummary = {
    secureStoreCleared: 0,
    asyncStorageCleared: 0,
    cashuProofsCleared: 0,
    derivedKeysCleared: 0,
    errors: [],
  };

  logger.info('[CacheService] Starting AGGRESSIVE cache clear...');

  try {
    // 1. Clear known SecureStore keys (in parallel)
    const secureStoreResults = await Promise.allSettled(
      CLEARABLE_SECURE_STORE_KEYS.map(async (key) => {
        await SecureStore.deleteItemAsync(key);
        return key;
      })
    );
    summary.secureStoreCleared = secureStoreResults.filter((r) => r.status === 'fulfilled').length;
    logger.info(`[CacheService] Cleared ${summary.secureStoreCleared} SecureStore keys`);

    // Cashu proofs are wallet funds, not cache. Never delete cashu_proofs*
    // from this path; full wallet deletion has a separate explicit reset flow.
    summary.cashuProofsCleared = 0;

    // 2. AGGRESSIVE: Clear all possible derived_key_* cache for multiple versions (in parallel)
    logger.info('[CacheService] Aggressively clearing derived key cache...');
    const derivedKeys: string[] = [];
    const keyVersions = ['v1_', 'v2_', 'v3_', 'v4_', ''];
    for (const version of keyVersions) {
      for (let i = 0; i < 50; i++) {
        derivedKeys.push(`derived_key_${version}account_${i}`, `derived_key_${version}${i}`);
      }
    }
    const derivedResults = await Promise.allSettled(
      derivedKeys.map((key) => SecureStore.deleteItemAsync(key))
    );
    summary.derivedKeysCleared = derivedResults.filter((r) => r.status === 'fulfilled').length;

    // 3. Clear AsyncStorage (except protected keys)
    try {
      const allAsyncKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allAsyncKeys.filter((key) => !isProtectedAsyncStorageKey(key));

      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        summary.asyncStorageCleared = keysToRemove.length;
        logger.info(`[CacheService] Cleared ${keysToRemove.length} AsyncStorage keys`);
      }
    } catch (error: unknown) {
      logger.error('[CacheService] Failed to clear AsyncStorage:', { error });
      summary.errors.push(`AsyncStorage: ${(error as Error).message}`);
    }

    logger.info('[CacheService] AGGRESSIVE cache clear complete');
    return summary;
  } catch (error: unknown) {
    logger.error('[CacheService] Cache clear failed:', { error });
    summary.errors.push((error as Error).message);
    return summary;
  }
};

/**
 * Clear cached P2PK derivations during account recovery or support diagnostics.
 */
export const clearP2PKCache = async (): Promise<void> => {
  try {
    logger.info('[CacheService] Clearing P2PK cache...');

    await SecureStore.deleteItemAsync('p2pk_taproot_address_v3');
    await SecureStore.deleteItemAsync('p2pk_private_key_v3');

    logger.info('[CacheService] P2PK cache cleared');
  } catch (error: unknown) {
    logger.warn('[CacheService] Failed to clear P2PK cache:', { error: (error as Error).message });
  }
};

/**
 * Clear cached Cashu token metadata during account recovery or support diagnostics.
 */
export const clearCashuCache = async (): Promise<void> => {
  try {
    logger.info('[CacheService] Clearing Cashu cache...');

    await deletePreferenceItem('cashu_keysets');
    await deletePreferenceItem('processed_cashu_tokens');

    logger.info('[CacheService] Cashu cache cleared');
  } catch (error: unknown) {
    logger.warn('[CacheService] Failed to clear Cashu cache:', { error: (error as Error).message });
  }
};

export default {
  clearAppCache,
  clearP2PKCache,
  clearCashuCache,
};
