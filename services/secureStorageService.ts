/**
 * Secure Storage Service
 * Handles mnemonic and wallet data storage in secure storage
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { SECURE_KEYS } from '../utils/constants';
import { logger } from '../utils/logger';
import { DEVICE_ONLY, clearPreferenceItems } from './storagePolicy';
import { WALLET_DERIVATION_MODE_KEY } from './walletDerivationService';
import {
  DEFAULT_WALLET_DERIVATION_MODE,
  type WalletDerivationMode,
} from '../constants/bitcoin';
import { LIQUIDATION_SWAP_BROADCAST_RECOVERY_KEY } from './liquidation/recoveryKeys';
import { EVM_TRANSACTION_CHECKPOINT_STORAGE_KEY } from '../stores/evmTransactionCheckpointStore';
import { OPERATION_JOURNAL_STORAGE_KEY } from '../stores/operationJournalStore';
import { PENDING_TOKEN_KEY, PENDING_TOKEN_QUEUE_KEY } from '../stores/tokenProcessingStore';
import { TURBO_PROCESSING_STORAGE_KEY } from '../stores/turboProcessingStore';
import { VAULT_SETTLEMENT_STORAGE_KEY } from '../stores/vaultSettlementStore';
import {
  LIQUIDATION_TXIDS_KEY,
  SWAP_TXIDS_KEY,
  SWAP_TXIDS_MIGRATION_V2_KEY,
} from './transactionHistoryService';
import { VAULT_SETTLEMENT_HISTORY_STORAGE_KEY } from './vaultSettlementHistoryService';
import { withTimeout } from '../utils/withTimeout';

let sessionMnemonic: string | null = null;
const SECURE_STORE_READ_TIMEOUT_MS = 5000;

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

export const hasAccessibleMnemonic = async (): Promise<boolean> => {
  if (sessionMnemonic) {
    return true;
  }

  try {
    const mnemonic = await withTimeout(
      SecureStore.getItemAsync(SECURE_KEYS.MNEMONIC),
      SECURE_STORE_READ_TIMEOUT_MS,
      null,
      'secureStorage:hasAccessibleMnemonic',
    );
    if (!mnemonic) {
      return false;
    }

    cacheSessionMnemonic(mnemonic);
    return true;
  } catch (error: unknown) {
    logger.error('Failed to check mnemonic availability', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

export const canUseBiometricUnlockForMnemonic = async (): Promise<boolean> => {
  if (sessionMnemonic) {
    return true;
  }

  try {
    const creationMethod = await withTimeout(
      SecureStore.getItemAsync(SECURE_KEYS.WALLET_CREATION_METHOD),
      SECURE_STORE_READ_TIMEOUT_MS,
      null,
      'secureStorage:getWalletCreationMethod',
    );

    if (creationMethod !== 'passkey') {
      return true;
    }

    const appUnlockReady = await withTimeout(
      SecureStore.getItemAsync(SECURE_KEYS.MNEMONIC_APP_UNLOCK_READY),
      SECURE_STORE_READ_TIMEOUT_MS,
      null,
      'secureStorage:getMnemonicAppUnlockReady',
    );

    return appUnlockReady === 'true';
  } catch (error: unknown) {
    logger.warn('Failed to check biometric mnemonic unlock readiness', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

/**
 * Save mnemonic to secure storage
 * @param mnemonic - BIP39 mnemonic phrase
 * @throws Error if save fails (critical operation)
 */
export const saveMnemonic = async (mnemonic: string): Promise<void> => {
  try {
    await Promise.all([
      SecureStore.setItemAsync(SECURE_KEYS.MNEMONIC, mnemonic, DEVICE_ONLY),
      SecureStore.setItemAsync(SECURE_KEYS.MNEMONIC_APP_UNLOCK_READY, 'true', DEVICE_ONLY),
    ]);
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
    return await withTimeout(
      SecureStore.getItemAsync(SECURE_KEYS.MNEMONIC),
      SECURE_STORE_READ_TIMEOUT_MS,
      null,
      'secureStorage:getMnemonic',
    );
  } catch (error: unknown) {
    logger.error('Failed to get mnemonic', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
};

/**
 * Rehydrate the session-only mnemonic after a PIN unlock.
 * If the generic mnemonic is missing, passkey-created wallets must decrypt it
 * through the passkey path before the app is considered unlocked.
 */
export const unlockSessionMnemonicWithPin = async (pin: string): Promise<void> => {
  if (sessionMnemonic) {
    return;
  }

  const mnemonic = await getMnemonic();
  if (mnemonic) {
    cacheSessionMnemonic(mnemonic);
    return;
  }

  const [creationMethod, passkeyEnabled] = await Promise.all([
    SecureStore.getItemAsync(SECURE_KEYS.WALLET_CREATION_METHOD),
    SecureStore.getItemAsync(SECURE_KEYS.PASSKEY_ENABLED),
  ]);

  if (creationMethod === 'passkey' && passkeyEnabled === 'true') {
    const { unlockWithPasskey } = require('./passkey') as typeof import('./passkey');
    await unlockWithPasskey(pin);
    return;
  }

  throw new Error('Wallet secret unavailable. Restore your wallet to continue.');
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
    await Promise.all([
      SecureStore.deleteItemAsync(SECURE_KEYS.MNEMONIC),
      SecureStore.deleteItemAsync(SECURE_KEYS.MNEMONIC_APP_UNLOCK_READY),
    ]);
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
    if (!Number.isInteger(accountIndex) || accountIndex < 0) {
      logger.error('Invalid current account index', { accountIndex });
      return false;
    }

    await SecureStore.setItemAsync(SECURE_KEYS.CURRENT_ACCOUNT, accountIndex.toString(), DEVICE_ONLY);
    return true;
  } catch (error: unknown) {
    logger.error('Failed to save current account', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
};

/**
 * Retrieve current account index from secure storage
 * @returns Account index (defaults to 0 only when no account has been saved yet)
 */
export const getCurrentAccount = async (): Promise<number> => {
  try {
    const account = await SecureStore.getItemAsync(SECURE_KEYS.CURRENT_ACCOUNT);
    if (account === null) {
      return 0;
    }

    if (!/^\d+$/.test(account)) {
      throw new Error(`Invalid current account index: ${account}`);
    }

    const parsed = Number(account);
    if (!Number.isSafeInteger(parsed)) {
      throw new Error(`Invalid current account index: ${account}`);
    }

    return parsed;
  } catch (error: unknown) {
    logger.error('Failed to get current account', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
};

/**
 * Cache format for derived addresses
 */
interface CachedAddresses {
  version: number;
  accountIndex: number;
  derivationMode: WalletDerivationMode;
  addresses: {
    segwitAddress: string;
    taprootAddress: string;
    segwitPubkey: string;
    taprootPubkey: string;
  };
}

type WalletAddressCache = CachedAddresses['addresses'];

const ADDRESS_CACHE_VERSION = 3;

const isWalletDerivationMode = (value: unknown): value is WalletDerivationMode =>
  value === 'legacy_address_index' || value === 'bip44_account';

const hasValidAddressFields = (value: unknown): value is WalletAddressCache => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.segwitAddress === 'string' &&
    typeof record.taprootAddress === 'string' &&
    typeof record.segwitPubkey === 'string' &&
    typeof record.taprootPubkey === 'string'
  );
};

/**
 * Save cached addresses to secure storage
 * @param accountIndex - Account index these addresses were derived for
 * @param addresses - Derived addresses
 * @returns Success status
 */
export const saveCachedAddresses = async (
  accountIndex: number,
  addresses: WalletAddressCache,
  derivationMode: WalletDerivationMode = DEFAULT_WALLET_DERIVATION_MODE
): Promise<boolean> => {
  try {
    const cached: CachedAddresses = {
      version: ADDRESS_CACHE_VERSION,
      accountIndex,
      derivationMode,
      addresses,
    };
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
  accountIndex: number,
  derivationMode: WalletDerivationMode = DEFAULT_WALLET_DERIVATION_MODE
): Promise<WalletAddressCache | null> => {
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
        !isWalletDerivationMode(parsed.derivationMode) ||
        !parsed.addresses ||
        !hasValidAddressFields(parsed.addresses)) {
      logger.warn('Invalid cached addresses structure, clearing cache');
      await SecureStore.deleteItemAsync(SECURE_KEYS.CACHED_ADDRESSES);
      return null;
    }

    if (parsed.version !== ADDRESS_CACHE_VERSION) {
      logger.warn('Cached addresses version mismatch, clearing cache');
      await SecureStore.deleteItemAsync(SECURE_KEYS.CACHED_ADDRESSES);
      return null;
    }

    // Return null if account index doesn't match (need to re-derive)
    if (parsed.accountIndex !== accountIndex) return null;
    if (parsed.derivationMode !== derivationMode) return null;

    return parsed.addresses;
  } catch (error: unknown) {
    logger.error('Failed to get cached addresses', { error: error instanceof Error ? error.message : String(error) });
    return null;
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
  derivationMode: WalletDerivationMode;
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
  accountIndex: number,
  derivationMode: WalletDerivationMode = DEFAULT_WALLET_DERIVATION_MODE
): Promise<WalletAddressCache | null> => {
  try {
    // Check in-memory cache first (instant)
    const cacheKey = accountIndex.toString();
    const memoryEntry = memoryCache?.[cacheKey];
    if (
      memoryCache?.__version === ADDRESS_CACHE_VERSION &&
      hasValidAddressFields(memoryEntry) &&
      isWalletDerivationMode((memoryEntry as AccountAddresses).derivationMode) &&
      (memoryEntry as AccountAddresses).derivationMode === derivationMode
    ) {
      const { derivationMode: _mode, ...addresses } = memoryEntry as AccountAddresses;
      return addresses;
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

    if (parsed.__version !== ADDRESS_CACHE_VERSION) {
      logger.warn('Multi-account cache version mismatch, clearing cache');
      await SecureStore.deleteItemAsync(SECURE_KEYS.MULTI_ACCOUNT_CACHE);
      return null;
    }

    // Populate memory cache
    memoryCache = parsed;

    const storedEntry = parsed[cacheKey];
    if (
      hasValidAddressFields(storedEntry) &&
      isWalletDerivationMode((storedEntry as AccountAddresses).derivationMode) &&
      (storedEntry as AccountAddresses).derivationMode === derivationMode
    ) {
      const { derivationMode: _mode, ...addresses } = storedEntry as AccountAddresses;
      return addresses;
    }

    return null;
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
  addresses: WalletAddressCache,
  derivationMode: WalletDerivationMode = DEFAULT_WALLET_DERIVATION_MODE
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
    let cache: MultiAccountCache = { __version: ADDRESS_CACHE_VERSION };

    if (memoryCache?.__version === ADDRESS_CACHE_VERSION) {
      cache = { ...memoryCache };
    } else {
      const existing = await SecureStore.getItemAsync(SECURE_KEYS.MULTI_ACCOUNT_CACHE);
      if (existing) {
        try {
          const parsed = JSON.parse(existing);
          // Validate structure
          if (
            typeof parsed === 'object' &&
            parsed !== null &&
            !Array.isArray(parsed) &&
            parsed.__version === ADDRESS_CACHE_VERSION
          ) {
            cache = { __version: ADDRESS_CACHE_VERSION, ...parsed };
          }
        } catch (parseError) {
          logger.warn('Invalid JSON in multi-account cache during save, resetting', { error: parseError instanceof Error ? parseError.message : String(parseError) });
        }
      }
    }

    // Add/update entry
    cache[accountIndex.toString()] = { ...addresses, derivationMode };

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
 * Delete all wallet data from secure storage
 * IMPORTANT: This clears ALL wallet data including PIN, passkey, and lockout state
 * NOTE: iCloud backup is preserved by default to allow wallet recovery
 * @param clearICloudBackup - Whether to also clear iCloud passkey backup (default: false)
 * @throws Error if critical deletion fails
 */
interface DeleteWalletDataOptions {
  preservePinAuth?: boolean;
}

export const deleteWalletData = async (
  clearICloudBackup = false,
  options: DeleteWalletDataOptions = {}
): Promise<void> => {
  try {
    const { preservePinAuth = false } = options;
    memoryCache = null;
    clearSessionMnemonic();

    const clearPasskeyDataPromise = (async (): Promise<void> => {
      try {
        const { clearPasskeyData } = await import('./passkey');
        await clearPasskeyData(clearICloudBackup);
      } catch (passkeyError) {
        // Passkey service might not be available or error clearing - continue anyway
        logger.warn('Failed to clear passkey data', { error: (passkeyError as Error).message });
      }
    })();

    const clearDerivedKeysPromise = (async (): Promise<void> => {
      try {
        const { clearAllDerivedKeys } = await import('../utils/wallet/keyDerivation');
        await clearAllDerivedKeys();
      } catch (derivedKeyError) {
        logger.warn('Failed to clear derived keys', { error: (derivedKeyError as Error).message });
      }
    })();

    const storageSnapshotPromise = Promise.all([
      SecureStore.getItemAsync(SECURE_KEYS.MULTI_ACCOUNT_CACHE),
      SecureStore.getItemAsync('sent_turbo_tokens'),
      SecureStore.getItemAsync('received_turbo_tokens'),
      SecureStore.getItemAsync(SECURE_KEYS.CURRENT_ACCOUNT),
    ]);
    const [multiAccountCacheRaw, sentLockedTokensRaw, receivedLockedTokensRaw, currentAccountRaw] =
      await storageSnapshotPromise;
    await Promise.all([clearPasskeyDataPromise, clearDerivedKeysPromise]);

    const proofKeys = new Set<string>(['cashu_proofs', 'cashu_proofs_sat']);
    const accountScopedStorageIndexes = new Set<number>([0]);
    const addAccountScopedStorageIndex = (value: string | number | null | undefined): void => {
      const parsed = typeof value === 'number' ? value : Number(value);
      if (Number.isSafeInteger(parsed) && parsed >= 0) {
        accountScopedStorageIndexes.add(parsed);
      }
    };
    addAccountScopedStorageIndex(currentAccountRaw);

    try {
      if (multiAccountCacheRaw) {
        const parsed = JSON.parse(multiAccountCacheRaw) as Record<string, unknown>;
        Object.entries(parsed).forEach(([accountIndex, value]) => {
          addAccountScopedStorageIndex(accountIndex);
          if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            typeof (value as { taprootAddress?: unknown }).taprootAddress === 'string'
          ) {
            const taprootAddress = (value as { taprootAddress: string }).taprootAddress;
            proofKeys.add(`cashu_proofs_${taprootAddress}`);
            proofKeys.add(`cashu_proofs_${taprootAddress}_sat`);
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
            proofKeys.add(`cashu_proofs_${record.taprootAddress}_sat`);
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

    const extraSecureStoreKeys = new Set<string>();
    const collectRegistryEntries = async (
      registryKey: string,
      mapEntryToStorageKey: (entry: string) => string = (entry) => entry,
    ): Promise<void> => {
      extraSecureStoreKeys.add(registryKey);
      try {
        const raw = await SecureStore.getItemAsync(registryKey);
        if (!raw) return;
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
          logger.warn('SecureStore registry was not an array during wallet deletion', { registryKey });
          return;
        }
        parsed
          .filter((entry): entry is string => typeof entry === 'string')
          .forEach((entry) => extraSecureStoreKeys.add(mapEntryToStorageKey(entry)));
      } catch (error) {
        logger.warn('Failed to parse SecureStore registry during wallet deletion', {
          registryKey,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    await Promise.all([
      collectRegistryEntries('cashu_pending_swaps_v1', (swapId) => `cashu_pending_swap_${swapId}`),
      collectRegistryEntries('cashu_pending_turbo_sends_v1'),
      collectRegistryEntries('cashu_failed_proof_recovery_keys_v1'),
    ]);

    const preferenceKeysToDelete = [
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
    ];

    const asyncStorageKeysToDelete = new Set<string>([
      LIQUIDATION_SWAP_BROADCAST_RECOVERY_KEY,
      EVM_TRANSACTION_CHECKPOINT_STORAGE_KEY,
      OPERATION_JOURNAL_STORAGE_KEY,
      TURBO_PROCESSING_STORAGE_KEY,
      VAULT_SETTLEMENT_STORAGE_KEY,
      VAULT_SETTLEMENT_HISTORY_STORAGE_KEY,
      SWAP_TXIDS_KEY,
      SWAP_TXIDS_MIGRATION_V2_KEY,
      LIQUIDATION_TXIDS_KEY,
    ]);

    const secureStoreKeysToDelete = new Set<string>([
      ...proofKeys,
      'cashu_pending_swap',
      'cashu_pending_swaps_v1',
      'cashu_pending_mint_quotes',
      'cashu_pending_turbo_send',
      'cashu_pending_turbo_sends_v1',
      'cashu_recovered_outgoing_swap_tokens_v1',
      PENDING_TOKEN_KEY,
      PENDING_TOKEN_QUEUE_KEY,
      'sent_turbo_tokens',
      'received_turbo_tokens',
      'cashu_proof_keys_v1',
      'cashu_failed_proof_recovery_keys_v1',
      'cashu_failed_proofs_latest_v1',

      // Wallet data
      SECURE_KEYS.MNEMONIC,
      SECURE_KEYS.MNEMONIC_APP_UNLOCK_READY,
      SECURE_KEYS.CURRENT_ACCOUNT,
      SECURE_KEYS.CACHED_ADDRESSES,
      SECURE_KEYS.MULTI_ACCOUNT_CACHE,

      // Unified auth lockout state
      'pin_failed_attempts',
      'pin_lockout_until',
      'pin_failed_attempts_v2',
      'pin_lockout_until_v2',
      'biometric_failed_attempts_v1',
      'biometric_lockout_until_v1',

      // Passkey-related keys (belt and suspenders - clearPasskeyData should handle these)
      SECURE_KEYS.PASSKEY_ENABLED,
      SECURE_KEYS.PASSKEY_CREDENTIAL_ID,
      SECURE_KEYS.PASSKEY_USER_HANDLE,
      SECURE_KEYS.PASSKEY_PEPPER,
      SECURE_KEYS.WALLET_CREATION_METHOD,
      WALLET_DERIVATION_MODE_KEY,
    ]);

    accountScopedStorageIndexes.forEach((accountIndex) => {
      secureStoreKeysToDelete.add(`pending_txs_${accountIndex}`);
      secureStoreKeysToDelete.add(`spent_utxos_${accountIndex}`);
      secureStoreKeysToDelete.add(`pending_vault_tx_${accountIndex}`);
    });

    extraSecureStoreKeys.forEach((key) => secureStoreKeysToDelete.add(key));

    if (!preservePinAuth) {
      [
        SECURE_KEYS.PIN,
        SECURE_KEYS.PIN_SALT,
        SECURE_KEYS.PIN_SALT_HMAC,
        SECURE_KEYS.PIN_HMAC_KEY,
        SECURE_KEYS.PIN_VERSION,
        SECURE_KEYS.BIOMETRIC_ENABLED,
      ].forEach((key) => secureStoreKeysToDelete.add(key));
    }

    // Clear all wallet-related storage keys, deduplicating SecureStore work where registries overlap.
    await Promise.all([
      clearPreferenceItems(preferenceKeysToDelete),
      ...Array.from(asyncStorageKeysToDelete).map((key) => AsyncStorage.removeItem(key)),
      ...Array.from(secureStoreKeysToDelete).map((key) => SecureStore.deleteItemAsync(key)),
    ]);
  } catch (error: unknown) {
    logger.error(error as Error, { context: 'deleteWalletData' });
    throw new Error('Failed to delete wallet data securely');
  }
};
