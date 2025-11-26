/**
 * Cache Service
 * Clear all app cache except for sensitive data (mnemonic, PIN, etc.)
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import { SECURE_KEYS } from '../utils/constants';

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

  // Cashu keysets
  'cashu_keysets',
  'cashu_proofs', // Old global key

  // Turbo tokens
  'sent_turbo_tokens',
  'received_turbo_tokens',

  // Transaction cache
  'pending_transactions',

  // Settings cache
  'app_settings',
  'display_preferences',

  // Current account (will be re-derived on next load)
  'current_account',
];

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
    // 1. Clear known SecureStore keys
    for (const key of CLEARABLE_SECURE_STORE_KEYS) {
      try {
        await SecureStore.deleteItemAsync(key);
        summary.secureStoreCleared++;
        logger.info(`[CacheService] Cleared SecureStore key: ${key}`);
      } catch (error) {
        // Key might not exist, that's okay
        if (!(error as Error).message.includes('not found')) {
          logger.warn(`[CacheService] Failed to clear ${key}:`, { error: (error as Error).message });
        }
      }
    }

    // 2. AGGRESSIVE: Clear all possible cashu_proofs_* keys for accounts 0-50
    logger.info('[CacheService] Aggressively clearing cashu proofs for all accounts...');
    for (let i = 0; i < 50; i++) {
      // Try multiple address patterns that might exist
      const possibleKeys = [
        `cashu_proofs_account_${i}`,
        `cashu_proofs_${i}`,
      ];

      for (const key of possibleKeys) {
        try {
          await SecureStore.deleteItemAsync(key);
          summary.cashuProofsCleared++;
        } catch (error) {
          // Ignore - key doesn't exist
        }
      }
    }

    // 3. AGGRESSIVE: Clear all possible derived_key_* cache for multiple versions
    logger.info('[CacheService] Aggressively clearing derived key cache...');
    const keyVersions = ['v1_', 'v2_', 'v3_', 'v4_', ''];
    for (const version of keyVersions) {
      for (let i = 0; i < 50; i++) {
        const possibleKeys = [
          `derived_key_${version}account_${i}`,
          `derived_key_${version}${i}`,
        ];

        for (const key of possibleKeys) {
          try {
            await SecureStore.deleteItemAsync(key);
            summary.derivedKeysCleared++;
          } catch (error) {
            // Ignore - key doesn't exist
          }
        }
      }
    }

    // 4. Clear AsyncStorage (except protected keys)
    try {
      const allAsyncKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allAsyncKeys.filter(key => !PROTECTED_KEYS.includes(key));

      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        summary.asyncStorageCleared = keysToRemove.length;
        logger.info(`[CacheService] Cleared ${keysToRemove.length} AsyncStorage keys`);
      }
    } catch (error) {
      logger.error('[CacheService] Failed to clear AsyncStorage:', { error });
      summary.errors.push(`AsyncStorage: ${(error as Error).message}`);
    }

    logger.info('[CacheService] AGGRESSIVE cache clear complete');
    return summary;
  } catch (error) {
    logger.error('[CacheService] Cache clear failed:', { error });
    summary.errors.push((error as Error).message);
    return summary;
  }
};

/**
 * Clear P2PK cache specifically (useful for debugging P2PK issues)
 */
export const clearP2PKCache = async (): Promise<void> => {
  try {
    logger.info('[CacheService] Clearing P2PK cache...');

    await SecureStore.deleteItemAsync('p2pk_taproot_address_v3');
    await SecureStore.deleteItemAsync('p2pk_private_key_v3');

    logger.info('[CacheService] P2PK cache cleared');
  } catch (error) {
    logger.warn('[CacheService] Failed to clear P2PK cache:', { error: (error as Error).message });
  }
};

/**
 * Clear Cashu token cache (useful for debugging token issues)
 */
export const clearCashuCache = async (): Promise<void> => {
  try {
    logger.info('[CacheService] Clearing Cashu cache...');

    await SecureStore.deleteItemAsync('cashu_keysets');
    await SecureStore.deleteItemAsync('sent_turbo_tokens');
    await SecureStore.deleteItemAsync('received_turbo_tokens');

    logger.info('[CacheService] Cashu cache cleared');
  } catch (error) {
    logger.warn('[CacheService] Failed to clear Cashu cache:', { error: (error as Error).message });
  }
};

export default {
  clearAppCache,
  clearP2PKCache,
  clearCashuCache,
};
