/**
 * Secure Storage Service
 * Handles mnemonic and wallet data storage in secure storage
 */

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { SECURE_KEYS } from '../utils/constants';
import { logger } from '../utils/logger';

/**
 * Attempt to securely clear a string from memory (BEST EFFORT ONLY)
 *
 * SECURITY NOTE: This function provides LIMITED security guarantees
 * ============================================================
 *
 * JavaScript's memory model does NOT support secure memory wiping:
 *
 * 1. STRING IMMUTABILITY: JavaScript strings are immutable. Any operation
 *    creates NEW string objects in memory, leaving the original intact until
 *    garbage collected. This function cannot overwrite the original string.
 *
 * 2. GARBAGE COLLECTOR: JavaScript's GC is non-deterministic. Old string
 *    references may persist in memory for seconds, minutes, or longer.
 *    We have no control over when (or if) memory is actually freed.
 *
 * 3. JIT COMPILER: V8/Hermes JIT may create multiple copies of strings
 *    during optimization. These copies are invisible to JavaScript and
 *    cannot be wiped by this function.
 *
 * 4. MEMORY FRAGMENTATION: Even after GC, sensitive data may remain in
 *    freed memory pages until overwritten by other allocations.
 *
 * 5. SWAP/HIBERNATION: On mobile devices, memory may be paged to disk
 *    during low memory conditions, persisting sensitive data to storage.
 *
 * 6. CRASH DUMPS: Core dumps or crash reports may capture memory contents
 *    including sensitive data, even after this "wiping" attempt.
 *
 * ACTUAL SECURITY MEASURES:
 * ========================
 *
 * PRIMARY DEFENSE: **Minimize mnemonic lifetime** using the withMnemonic()
 * pattern. Keep sensitive data in memory for <100ms instead of seconds/minutes.
 *
 * SECONDARY DEFENSE: This function attempts to create garbage to increase
 * likelihood of memory overwriting, but provides NO GUARANTEES.
 *
 * TERTIARY DEFENSE: Device-level encryption (iOS/Android full-disk encryption)
 * protects memory dumps and swap files at rest.
 *
 * RECOMMENDATION FOR MAINNET: Consider implementing a native module using:
 * - iOS: SecureEnclave + sodium_memzero() from libsodium
 * - Android: KeyStore + sodium_memzero() from libsodium
 *
 * These provide hardware-backed secure memory with guaranteed wiping.
 *
 * @param str - String to attempt wiping (will NOT be modified due to immutability)
 * @returns A new string filled with random data (original string persists in memory)
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
 * @throws Error if save fails (critical operation)
 */
export const saveMnemonic = async (mnemonic: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(SECURE_KEYS.MNEMONIC, mnemonic);
  } catch (error: unknown) {
    logger.error('Failed to save mnemonic', { error: error instanceof Error ? error.message : String(error) });
    throw new Error('Failed to save wallet securely');
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
 * @throws Error if delete fails (critical operation)
 */
export const deleteMnemonic = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(SECURE_KEYS.MNEMONIC);
  } catch (error: unknown) {
    logger.error('Failed to delete mnemonic', { error: error instanceof Error ? error.message : String(error) });
    throw new Error('Failed to delete wallet securely');
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
 * @throws Error if critical deletion fails
 */
export const deleteWalletData = async (clearICloudBackup = false): Promise<void> => {
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
  } catch (error: unknown) {
    logger.error(error as Error, { context: 'deleteWalletData' });
    throw new Error('Failed to delete wallet data securely');
  }
};
