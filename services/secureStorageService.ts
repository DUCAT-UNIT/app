/**
 * Secure Storage Service
 * Handles mnemonic and wallet data storage in secure storage
 */

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { SECURE_KEYS } from '../utils/constants';
import { logger } from '../utils/logger';

/**
 * Securely clear a string from memory (best effort)
 * Note: JavaScript doesn't guarantee memory overwriting, but we try our best
 * @param str - String to clear
 * @returns Cleared string (filled with zeros)
 */
const securelyWipeString = (str: string | null): string => {
  if (!str || typeof str !== 'string') return '';

  // Create a new string filled with zeros
  let cleared = '';
  for (let i = 0; i < str.length; i++) {
    cleared += '\0';
  }

  // Generate cryptographically secure random bytes for overwriting
  // Using expo-crypto for secure random generation
  const randomBytes = Crypto.getRandomBytes(str.length * 3);

  // Overwrite multiple times with secure random data
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < str.length; i++) {
      cleared =
        cleared.substring(0, i) +
        String.fromCharCode(randomBytes[pass * str.length + i]) +
        cleared.substring(i + 1);
    }
  }

  return cleared;
};

/**
 * Save mnemonic to secure storage
 * @param mnemonic - BIP39 mnemonic phrase
 * @returns Success status
 */
export const saveMnemonic = async (mnemonic: string): Promise<boolean> => {
  try {
    await SecureStore.setItemAsync(SECURE_KEYS.MNEMONIC, mnemonic);
    return true;
  } catch (error: unknown) {
    logger.error('Failed to save mnemonic', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
};

/**
 * Retrieve mnemonic from secure storage
 * IMPORTANT: Caller must clear the returned mnemonic from memory after use
 * @returns Mnemonic or null if not found
 */
export const getMnemonic = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(SECURE_KEYS.MNEMONIC);
  } catch (error: unknown) {
    logger.error('Failed to get mnemonic', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
};

/**
 * Retrieve mnemonic and automatically clear it after callback execution
 * Use this when you need temporary access to mnemonic
 * @param callback - Function that receives mnemonic
 * @returns Result from callback
 */
export const withMnemonic = async <T>(callback: (mnemonic: string) => Promise<T>): Promise<T> => {
  let mnemonic: string | null = null;
  try {
    mnemonic = await getMnemonic();
    if (!mnemonic) {
      throw new Error('Mnemonic not found');
    }
    return await callback(mnemonic);
  } finally {
    // Best effort to clear from memory
    if (mnemonic) {
      mnemonic = securelyWipeString(mnemonic);
      mnemonic = null;
    }
  }
};

/**
 * Delete mnemonic from secure storage
 * @returns Success status
 */
export const deleteMnemonic = async (): Promise<boolean> => {
  try {
    await SecureStore.deleteItemAsync(SECURE_KEYS.MNEMONIC);
    return true;
  } catch (error: unknown) {
    logger.error('Failed to delete mnemonic', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
};

/**
 * Save current account index to secure storage
 * @param accountIndex - Account index
 * @returns Success status
 */
export const saveCurrentAccount = async (accountIndex: number): Promise<boolean> => {
  try {
    await SecureStore.setItemAsync(SECURE_KEYS.CURRENT_ACCOUNT, accountIndex.toString());
    return true;
  } catch (error: unknown) {
    logger.error('Failed to save current account', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
};

/**
 * Retrieve current account index from secure storage
 * @returns Account index (defaults to 0)
 */
export const getCurrentAccount = async (): Promise<number> => {
  try {
    const account = await SecureStore.getItemAsync(SECURE_KEYS.CURRENT_ACCOUNT);
    return account ? parseInt(account, 10) : 0;
  } catch (error: unknown) {
    logger.error('Failed to get current account', { error: error instanceof Error ? error.message : String(error) });
    return 0;
  }
};

/**
 * Cache format for derived addresses
 */
interface CachedAddresses {
  accountIndex: number;
  addresses: {
    segwitAddress: string;
    taprootAddress: string;
    segwitPubkey: string;
    taprootPubkey: string;
  };
}

/**
 * Save cached addresses to secure storage
 * @param accountIndex - Account index these addresses were derived for
 * @param addresses - Derived addresses
 * @returns Success status
 */
export const saveCachedAddresses = async (
  accountIndex: number,
  addresses: { segwitAddress: string; taprootAddress: string; segwitPubkey: string; taprootPubkey: string }
): Promise<boolean> => {
  try {
    const cached: CachedAddresses = { accountIndex, addresses };
    await SecureStore.setItemAsync(SECURE_KEYS.CACHED_ADDRESSES, JSON.stringify(cached));
    return true;
  } catch (error: unknown) {
    logger.error('Failed to save cached addresses', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
};

/**
 * Retrieve cached addresses from secure storage
 * @param accountIndex - Expected account index (returns null if mismatch)
 * @returns Cached addresses or null if not found/mismatch
 */
export const getCachedAddresses = async (
  accountIndex: number
): Promise<{ segwitAddress: string; taprootAddress: string; segwitPubkey: string; taprootPubkey: string } | null> => {
  try {
    const cached = await SecureStore.getItemAsync(SECURE_KEYS.CACHED_ADDRESSES);
    if (!cached) return null;

    let parsed: CachedAddresses;
    try {
      parsed = JSON.parse(cached);
    } catch (parseError) {
      logger.warn('Invalid JSON in cached addresses, clearing cache', { error: parseError instanceof Error ? parseError.message : String(parseError) });
      await SecureStore.deleteItemAsync(SECURE_KEYS.CACHED_ADDRESSES);
      return null;
    }

    // Validate structure
    if (typeof parsed !== 'object' || parsed === null ||
        typeof parsed.accountIndex !== 'number' ||
        !parsed.addresses ||
        typeof parsed.addresses.segwitAddress !== 'string') {
      logger.warn('Invalid cached addresses structure, clearing cache');
      await SecureStore.deleteItemAsync(SECURE_KEYS.CACHED_ADDRESSES);
      return null;
    }

    // Return null if account index doesn't match (need to re-derive)
    if (parsed.accountIndex !== accountIndex) return null;

    return parsed.addresses;
  } catch (error: unknown) {
    logger.error('Failed to get cached addresses', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
};

/**
 * Delete cached addresses from secure storage
 * @returns Success status
 */
export const deleteCachedAddresses = async (): Promise<boolean> => {
  try {
    await SecureStore.deleteItemAsync(SECURE_KEYS.CACHED_ADDRESSES);
    return true;
  } catch (error: unknown) {
    logger.error('Failed to delete cached addresses', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
};

/**
 * Multi-account cache format
 * Stores addresses for multiple accounts to enable fast account switching
 */
interface MultiAccountCache {
  [accountIndex: string]: {
    segwitAddress: string;
    taprootAddress: string;
    segwitPubkey: string;
    taprootPubkey: string;
  };
}

// In-memory cache for even faster lookups (avoids async storage read)
let memoryCache: MultiAccountCache | null = null;

// Mutex to prevent race conditions during cache operations
let cacheOperationInProgress: Promise<void> | null = null;

/**
 * Get addresses from multi-account cache
 * Uses in-memory cache first, then falls back to secure storage
 * @param accountIndex - Account index to lookup
 * @returns Cached addresses or null if not found
 */
export const getMultiAccountCache = async (
  accountIndex: number
): Promise<{ segwitAddress: string; taprootAddress: string; segwitPubkey: string; taprootPubkey: string } | null> => {
  try {
    // Check in-memory cache first (instant)
    if (memoryCache && memoryCache[accountIndex.toString()]) {
      return memoryCache[accountIndex.toString()];
    }

    // Fall back to secure storage
    const cached = await SecureStore.getItemAsync(SECURE_KEYS.MULTI_ACCOUNT_CACHE);
    if (!cached) return null;

    let parsed: MultiAccountCache;
    try {
      parsed = JSON.parse(cached);
    } catch (parseError) {
      logger.warn('Invalid JSON in multi-account cache, clearing cache', { error: parseError instanceof Error ? parseError.message : String(parseError) });
      await SecureStore.deleteItemAsync(SECURE_KEYS.MULTI_ACCOUNT_CACHE);
      return null;
    }

    // Validate structure is an object
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      logger.warn('Invalid multi-account cache structure, clearing cache');
      await SecureStore.deleteItemAsync(SECURE_KEYS.MULTI_ACCOUNT_CACHE);
      return null;
    }

    // Populate memory cache
    memoryCache = parsed;

    return parsed[accountIndex.toString()] || null;
  } catch (error: unknown) {
    logger.error('Failed to get multi-account cache', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
};

/**
 * Save addresses to multi-account cache
 * Updates both in-memory and secure storage
 * @param accountIndex - Account index
 * @param addresses - Derived addresses
 * @returns Success status
 */
export const saveToMultiAccountCache = async (
  accountIndex: number,
  addresses: { segwitAddress: string; taprootAddress: string; segwitPubkey: string; taprootPubkey: string }
): Promise<boolean> => {
  // Wait for any pending operation to complete (prevents race conditions)
  if (cacheOperationInProgress) {
    await cacheOperationInProgress;
  }

  let resolveOperation: () => void;
  cacheOperationInProgress = new Promise<void>((resolve) => {
    resolveOperation = resolve;
  });

  try {
    // Load existing cache or create new
    let cache: MultiAccountCache = {};

    if (memoryCache) {
      cache = { ...memoryCache };
    } else {
      const existing = await SecureStore.getItemAsync(SECURE_KEYS.MULTI_ACCOUNT_CACHE);
      if (existing) {
        try {
          const parsed = JSON.parse(existing);
          // Validate structure
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            cache = parsed;
          }
        } catch (parseError) {
          logger.warn('Invalid JSON in multi-account cache during save, resetting', { error: parseError instanceof Error ? parseError.message : String(parseError) });
        }
      }
    }

    // Add/update entry
    cache[accountIndex.toString()] = addresses;

    // Update memory cache
    memoryCache = cache;

    // Persist to secure storage
    await SecureStore.setItemAsync(SECURE_KEYS.MULTI_ACCOUNT_CACHE, JSON.stringify(cache));
    return true;
  } catch (error: unknown) {
    logger.error('Failed to save to multi-account cache', { error: error instanceof Error ? error.message : String(error) });
    return false;
  } finally {
    resolveOperation!();
    cacheOperationInProgress = null;
  }
};

/**
 * Clear the multi-account cache (both memory and storage)
 * @returns Success status
 */
export const clearMultiAccountCache = async (): Promise<boolean> => {
  try {
    memoryCache = null;
    await SecureStore.deleteItemAsync(SECURE_KEYS.MULTI_ACCOUNT_CACHE);
    return true;
  } catch (error: unknown) {
    logger.error('Failed to clear multi-account cache', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
};

/**
 * Delete all wallet data from secure storage
 * IMPORTANT: This clears ALL wallet data including PIN, passkey, and lockout state
 * NOTE: iCloud backup is preserved by default to allow wallet recovery
 * @param clearICloudBackup - Whether to also clear iCloud passkey backup (default: false)
 * @returns Success status
 */
export const deleteWalletData = async (clearICloudBackup = false): Promise<boolean> => {
  try {
    // Clear passkey data if it exists (iCloud backup preserved by default for recovery)
    try {
      const { clearPasskeyData } = await import('./passkey');
      await clearPasskeyData(clearICloudBackup);
    } catch (passkeyError) {
      // Passkey service might not be available or error clearing - continue anyway
      logger.warn('Failed to clear passkey data', { error: (passkeyError as Error).message });
    }

    // Clear all wallet-related secure storage keys
    await Promise.all([
      // Wallet data
      SecureStore.deleteItemAsync(SECURE_KEYS.MNEMONIC),
      SecureStore.deleteItemAsync(SECURE_KEYS.CURRENT_ACCOUNT),
      SecureStore.deleteItemAsync(SECURE_KEYS.CACHED_ADDRESSES),
      SecureStore.deleteItemAsync(SECURE_KEYS.MULTI_ACCOUNT_CACHE),

      // PIN and authentication
      SecureStore.deleteItemAsync(SECURE_KEYS.PIN),
      SecureStore.deleteItemAsync(SECURE_KEYS.PIN_SALT),
      SecureStore.deleteItemAsync(SECURE_KEYS.PIN_VERSION),
      SecureStore.deleteItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED),

      // PIN lockout state (from pinService.js LOCKOUT_KEYS)
      SecureStore.deleteItemAsync('pin_failed_attempts'),
      SecureStore.deleteItemAsync('pin_lockout_until'),

      // Pending operations (from useWalletActions.js, usePostAuthHandler.js)
      SecureStore.deleteItemAsync('pendingWalletDelete'),
      SecureStore.deleteItemAsync('pendingFaceIdEnable'),
      SecureStore.deleteItemAsync('pendingNotificationsEnable'),

      // Settings navigation state (from useSettingsNavigation.js)
      SecureStore.deleteItemAsync('returnToSettingsAfterAuth'),
      SecureStore.deleteItemAsync('returnToSettingsAfterPinChange'),
      SecureStore.deleteItemAsync('returnToSettingsAfterSeedPhrase'),

      // User preferences (optional - you might want to keep these)
      SecureStore.deleteItemAsync('notificationsEnabled'),
      SecureStore.deleteItemAsync('showZeroAssets'),

      // Passkey-related keys (belt and suspenders - clearPasskeyData should handle these)
      SecureStore.deleteItemAsync(SECURE_KEYS.PASSKEY_ENABLED),
      SecureStore.deleteItemAsync(SECURE_KEYS.PASSKEY_CREDENTIAL_ID),
      SecureStore.deleteItemAsync(SECURE_KEYS.PASSKEY_USER_HANDLE),
      SecureStore.deleteItemAsync(SECURE_KEYS.WALLET_CREATION_METHOD),
    ]);

    return true;
  } catch (error: unknown) {
    logger.error(error as Error, { context: 'deleteWalletData' });
    return false;
  }
};
