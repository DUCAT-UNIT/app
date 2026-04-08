/**
 * Secure Storage Service
 * Handles mnemonic and wallet data storage in secure storage
 */

import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import { SECURE_KEYS } from '../utils/constants';
import { logger } from '../utils/logger';
import { DEVICE_ONLY, clearPreferenceItems } from './storagePolicy';
import { WALLET_DERIVATION_MODE_KEY } from './walletDerivationService';

let sessionMnemonic: string | null = null;

// Clear cached mnemonic when app goes to background to reduce exposure window
AppState.addEventListener('change', (nextState) => {
  if (nextState === 'background') {
    sessionMnemonic = null;
  }
});

export const cacheSessionMnemonic = (mnemonic: string): void => {
  sessionMnemonic = mnemonic;
};

export const clearSessionMnemonic = (): void => {
  sessionMnemonic = null;
};

export const hasSessionMnemonic = (): boolean => sessionMnemonic !== null;

/**
 * Save mnemonic to secure storage
 * @param mnemonic - BIP39 mnemonic phrase
 * @throws Error if save fails (critical operation)
 */
export const saveMnemonic = async (mnemonic: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(SECURE_KEYS.MNEMONIC, mnemonic, DEVICE_ONLY);
    cacheSessionMnemonic(mnemonic);
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
    if (sessionMnemonic) {
      return sessionMnemonic;
    }
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
      const [creationMethod, passkeyEnabled] = await Promise.all([
        SecureStore.getItemAsync(SECURE_KEYS.WALLET_CREATION_METHOD),
        SecureStore.getItemAsync(SECURE_KEYS.PASSKEY_ENABLED),
      ]);
      if (creationMethod === 'passkey' && passkeyEnabled === 'true') {
        throw new Error('Passkey wallet is locked. Unlock with your PIN to re-establish the secure session.');
      }
      throw new Error('Mnemonic not found');
    }
    return await callback(mnemonic);
  } finally {
    // Nulling a local variable doesn't wipe the string the caller received --
    // JS strings are immutable and GC-managed. This just drops *our* reference
    // to minimize the number of live references to the mnemonic.
    mnemonic = null;
  }
};

/**
 * Delete mnemonic from secure storage
 * @throws Error if delete fails (critical operation)
 */
export const deleteMnemonic = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(SECURE_KEYS.MNEMONIC);
    clearSessionMnemonic();
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
    await SecureStore.setItemAsync(SECURE_KEYS.CURRENT_ACCOUNT, accountIndex.toString(), DEVICE_ONLY);
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
  version: number;
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
    const cached: CachedAddresses = { version: 2, accountIndex, addresses };
    await SecureStore.setItemAsync(SECURE_KEYS.CACHED_ADDRESSES, JSON.stringify(cached), DEVICE_ONLY);
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
        typeof parsed.version !== 'number' ||
        !parsed.addresses ||
        typeof parsed.addresses.segwitAddress !== 'string') {
      logger.warn('Invalid cached addresses structure, clearing cache');
      await SecureStore.deleteItemAsync(SECURE_KEYS.CACHED_ADDRESSES);
      return null;
    }

    if (parsed.version !== 2) {
      logger.warn('Cached addresses version mismatch, clearing cache');
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
interface AccountAddresses {
  segwitAddress: string;
  taprootAddress: string;
  segwitPubkey: string;
  taprootPubkey: string;
}

interface MultiAccountCache {
  __version?: number;
  [accountIndex: string]: AccountAddresses | number | undefined;
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
      return memoryCache[accountIndex.toString()] as AccountAddresses;
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

    if (parsed.__version !== 2) {
      logger.warn('Multi-account cache version mismatch, clearing cache');
      await SecureStore.deleteItemAsync(SECURE_KEYS.MULTI_ACCOUNT_CACHE);
      return null;
    }

    // Populate memory cache
    memoryCache = parsed;

    return (parsed[accountIndex.toString()] as AccountAddresses) || null;
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
    let cache: MultiAccountCache = { __version: 2 };

    if (memoryCache) {
      cache = { ...memoryCache };
    } else {
      const existing = await SecureStore.getItemAsync(SECURE_KEYS.MULTI_ACCOUNT_CACHE);
      if (existing) {
        try {
          const parsed = JSON.parse(existing);
          // Validate structure
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            cache = { __version: 2, ...parsed };
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
    await SecureStore.setItemAsync(SECURE_KEYS.MULTI_ACCOUNT_CACHE, JSON.stringify(cache), DEVICE_ONLY);
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
    memoryCache = null;
    clearSessionMnemonic();

    // Clear passkey data if it exists (iCloud backup preserved by default for recovery)
    try {
      const { clearPasskeyData } = await import('./passkey');
      await clearPasskeyData(clearICloudBackup);
    } catch (passkeyError) {
      // Passkey service might not be available or error clearing - continue anyway
      logger.warn('Failed to clear passkey data', { error: (passkeyError as Error).message });
    }

    // Clear derived key cache and its index
    try {
      const { clearAllDerivedKeys } = await import('../utils/wallet/keyDerivation');
      await clearAllDerivedKeys();
    } catch (derivedKeyError) {
      logger.warn('Failed to clear derived keys', { error: (derivedKeyError as Error).message });
    }

    const [multiAccountCacheRaw, sentLockedTokensRaw, receivedLockedTokensRaw] = await Promise.all([
      SecureStore.getItemAsync(SECURE_KEYS.MULTI_ACCOUNT_CACHE),
      SecureStore.getItemAsync('sent_turbo_tokens'),
      SecureStore.getItemAsync('received_turbo_tokens'),
    ]);

    const proofKeys = new Set<string>(['cashu_proofs']);
    try {
      if (multiAccountCacheRaw) {
        const parsed = JSON.parse(multiAccountCacheRaw) as Record<string, unknown>;
        Object.values(parsed).forEach((value) => {
          if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            typeof (value as { taprootAddress?: unknown }).taprootAddress === 'string'
          ) {
            proofKeys.add(`cashu_proofs_${(value as { taprootAddress: string }).taprootAddress}`);
          }
        });
      }
    } catch (error: unknown) {
      logger.warn('Failed to parse multi-account cache while deleting wallet data', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const collectTokenProofKeys = (raw: string | null): void => {
      if (!raw) return;
      try {
        const records = JSON.parse(raw) as Array<{ taprootAddress?: string | null }>;
        records.forEach((record) => {
          if (record?.taprootAddress) {
            proofKeys.add(`cashu_proofs_${record.taprootAddress}`);
          }
        });
      } catch (error: unknown) {
        logger.warn('Failed to parse Cashu token history while deleting wallet data', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    collectTokenProofKeys(sentLockedTokensRaw);
    collectTokenProofKeys(receivedLockedTokensRaw);

    try {
      const { getAllProofStorageKeys } = await import('./cashu/cashuProofManager');
      const registeredKeys = await getAllProofStorageKeys();
      registeredKeys.forEach((key) => proofKeys.add(key));
    } catch (proofRegistryError) {
      logger.warn('Failed to load Cashu proof registry during wallet deletion', {
        error: (proofRegistryError as Error).message,
      });
    }

    await clearPreferenceItems([
      'pendingFaceIdEnable',
      'pendingNotificationsEnable',
      'returnToSettingsAfterAuth',
      'returnToSettingsAfterPinChange',
      'returnToSettingsAfterSeedPhrase',
      'pendingWalletDelete',
      'notificationsEnabled',
      'showZeroAssets',
      'advancedMode',
      'ecashThreshold',
    ]);

    // Clear all wallet-related secure storage keys
    await Promise.all([
      ...Array.from(proofKeys).map((key) => SecureStore.deleteItemAsync(key)),
      SecureStore.deleteItemAsync('cashu_pending_swap'),
      SecureStore.deleteItemAsync('cashu_pending_mint_quotes'),
      SecureStore.deleteItemAsync('cashu_pending_turbo_send'),
      SecureStore.deleteItemAsync('sent_turbo_tokens'),
      SecureStore.deleteItemAsync('received_turbo_tokens'),
      SecureStore.deleteItemAsync('cashu_proof_keys_v1'),
      SecureStore.deleteItemAsync('cashu_failed_proof_recovery_keys_v1'),

      // Wallet data
      SecureStore.deleteItemAsync(SECURE_KEYS.MNEMONIC),
      SecureStore.deleteItemAsync(SECURE_KEYS.CURRENT_ACCOUNT),
      SecureStore.deleteItemAsync(SECURE_KEYS.CACHED_ADDRESSES),
      SecureStore.deleteItemAsync(SECURE_KEYS.MULTI_ACCOUNT_CACHE),

      // PIN and authentication
      SecureStore.deleteItemAsync(SECURE_KEYS.PIN),
      SecureStore.deleteItemAsync(SECURE_KEYS.PIN_SALT),
      SecureStore.deleteItemAsync(SECURE_KEYS.PIN_SALT_HMAC),
      SecureStore.deleteItemAsync(SECURE_KEYS.PIN_HMAC_KEY),
      SecureStore.deleteItemAsync(SECURE_KEYS.PIN_VERSION),
      SecureStore.deleteItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED),

      // Unified auth lockout state
      SecureStore.deleteItemAsync('pin_failed_attempts'),
      SecureStore.deleteItemAsync('pin_lockout_until'),
      SecureStore.deleteItemAsync('pin_failed_attempts_v2'),
      SecureStore.deleteItemAsync('pin_lockout_until_v2'),
      SecureStore.deleteItemAsync('biometric_failed_attempts_v1'),
      SecureStore.deleteItemAsync('biometric_lockout_until_v1'),

      // Passkey-related keys (belt and suspenders - clearPasskeyData should handle these)
      SecureStore.deleteItemAsync(SECURE_KEYS.PASSKEY_ENABLED),
      SecureStore.deleteItemAsync(SECURE_KEYS.PASSKEY_CREDENTIAL_ID),
      SecureStore.deleteItemAsync(SECURE_KEYS.PASSKEY_USER_HANDLE),
      SecureStore.deleteItemAsync(SECURE_KEYS.PASSKEY_PEPPER),
      SecureStore.deleteItemAsync(SECURE_KEYS.WALLET_CREATION_METHOD),
      SecureStore.deleteItemAsync(WALLET_DERIVATION_MODE_KEY),
    ]);
  } catch (error: unknown) {
    logger.error(error as Error, { context: 'deleteWalletData' });
    throw new Error('Failed to delete wallet data securely');
  }
};
