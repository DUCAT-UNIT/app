/**
 * Cache Service
 * Clear all app cache except for sensitive data (mnemonic, PIN, etc.)
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import { SECURE_KEYS } from '../utils/constants';

// Keys to PRESERVE (never delete)
const PROTECTED_KEYS = [
  SECURE_KEYS.MNEMONIC,
  SECURE_KEYS.ENCRYPTED_MNEMONIC,
  SECURE_KEYS.PIN_HASH,
  SECURE_KEYS.PIN_SALT,
  SECURE_KEYS.LOCKOUT_UNTIL,
  SECURE_KEYS.FAILED_ATTEMPTS,
  SECURE_KEYS.BIOMETRIC_ENABLED,
  SECURE_KEYS.AUTH_SETTINGS,
  'onboarding_complete', // Preserve onboarding state
];

// Known SecureStore keys that can be safely cleared
const CLEARABLE_SECURE_STORE_KEYS = [
  // P2PK cache
  'p2pk_taproot_address_v3',
  'p2pk_private_key_v3',

  // Cashu keysets
  'cashu_keysets',

  // Turbo tokens
  'sent_turbo_tokens',
  'received_turbo_tokens',

  // Transaction cache
  'pending_transactions',
];

/**
 * Clear all app cache except for protected keys (mnemonic, PIN, etc.)
 * @returns {Promise<Object>} Summary of what was cleared
 */
export const clearAppCache = async () => {
  const summary = {
    secureStoreCleared: 0,
    asyncStorageCleared: 0,
    errors: [],
  };

  logger.info('[CacheService] Starting cache clear...');

  try {
    // 1. Clear known SecureStore keys
    for (const key of CLEARABLE_SECURE_STORE_KEYS) {
      try {
        await SecureStore.deleteItemAsync(key);
        summary.secureStoreCleared++;
        logger.info(`[CacheService] Cleared SecureStore key: ${key}`);
      } catch (error) {
        // Key might not exist, that's okay
        if (!error.message.includes('not found')) {
          logger.warn(`[CacheService] Failed to clear ${key}:`, error.message);
        }
      }
    }

    // 2. Clear AsyncStorage (except protected keys)
    try {
      const allAsyncKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allAsyncKeys.filter(key => !PROTECTED_KEYS.includes(key));

      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        summary.asyncStorageCleared = keysToRemove.length;
        logger.info(`[CacheService] Cleared ${keysToRemove.length} AsyncStorage keys`);
      }
    } catch (error) {
      logger.error('[CacheService] Failed to clear AsyncStorage:', error);
      summary.errors.push(`AsyncStorage: ${error.message}`);
    }

    logger.info('[CacheService] Cache clear complete', summary);
    return summary;
  } catch (error) {
    logger.error('[CacheService] Cache clear failed:', error);
    summary.errors.push(error.message);
    return summary;
  }
};

/**
 * Clear P2PK cache specifically (useful for debugging P2PK issues)
 * @returns {Promise<void>}
 */
export const clearP2PKCache = async () => {
  try {
    logger.info('[CacheService] Clearing P2PK cache...');

    await SecureStore.deleteItemAsync('p2pk_taproot_address_v3');
    await SecureStore.deleteItemAsync('p2pk_private_key_v3');

    logger.info('[CacheService] P2PK cache cleared');
  } catch (error) {
    logger.warn('[CacheService] Failed to clear P2PK cache:', error.message);
  }
};

/**
 * Clear Cashu token cache (useful for debugging token issues)
 * @returns {Promise<void>}
 */
export const clearCashuCache = async () => {
  try {
    logger.info('[CacheService] Clearing Cashu cache...');

    await SecureStore.deleteItemAsync('cashu_keysets');
    await SecureStore.deleteItemAsync('sent_turbo_tokens');
    await SecureStore.deleteItemAsync('received_turbo_tokens');

    logger.info('[CacheService] Cashu cache cleared');
  } catch (error) {
    logger.warn('[CacheService] Failed to clear Cashu cache:', error.message);
  }
};

export default {
  clearAppCache,
  clearP2PKCache,
  clearCashuCache,
};
