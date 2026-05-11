/**
 * Wallet Service - Wallet creation, import, and management
 */

import { Buffer } from 'buffer';
import * as Crypto from 'expo-crypto';
import * as bip39 from 'bip39';
import { deriveAddressesFromMnemonic, type DerivedAddresses } from '../utils/bitcoin';
import { DEFAULT_WALLET_DERIVATION_MODE } from '../constants/bitcoin';
import {
  getCurrentAccount,
  withMnemonic,
  saveMnemonic,
  saveCurrentAccount,
  getCachedAddresses,
  saveCachedAddresses,
  getMultiAccountCache,
  saveToMultiAccountCache,
} from './secureStorageService';
import { logger } from '../utils/logger';
import { withTimeout } from '../utils/withTimeout';
import { getWalletDerivationMode, setWalletDerivationMode } from './walletDerivationService';
import { startupDiagnostics } from './startupDiagnostics';

// Per-operation timeout for SecureStore reads during wallet load.
// iPad in iPhone compatibility mode can stall individual SecureStore calls.
const SECURESTORE_READ_TIMEOUT_MS = 5000;

const withRequiredSecureStoreRead = async <T>(promise: Promise<T>, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      startupDiagnostics.recordWarning('wallet_required_storage_timeout', {
        label,
        timeout_ms: SECURESTORE_READ_TIMEOUT_MS,
      });
      reject(new Error(`${label} timed out while loading wallet identity`));
    }, SECURESTORE_READ_TIMEOUT_MS);
    (timer as { unref?: () => void }).unref?.();
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

export interface GenerateWalletResult {
  mnemonic: string;
  addresses: DerivedAddresses;
}

export interface ImportWalletResult {
  addresses: DerivedAddresses;
}

export interface LoadWalletResult {
  addresses: DerivedAddresses | null;
  accountIndex: number;
}

export interface SwitchAccountResult {
  addresses: DerivedAddresses;
}

const saveCurrentAccountOrThrow = async (accountIndex: number): Promise<void> => {
  const saved = await saveCurrentAccount(accountIndex);
  if (!saved) {
    throw new Error('Failed to save current account securely');
  }
};

const assertValidAccountIndex = (accountIndex: number): void => {
  if (!Number.isSafeInteger(accountIndex) || accountIndex < 0) {
    throw new Error(`Invalid account index: ${accountIndex}`);
  }
};

/**
 * Generate a new wallet with a 12-word mnemonic
 * @param accountIndex - Account index for derivation (default: 0)
 * @returns Promise with mnemonic and addresses
 */
export const generateWallet = async (accountIndex = 0): Promise<GenerateWalletResult> => {
  try {
    assertValidAccountIndex(accountIndex);

    // Generate random bytes using expo-crypto
    const randomBytes = await Crypto.getRandomBytesAsync(16);

    // Generate a 12-word mnemonic
    const mnemonic = bip39.entropyToMnemonic(Buffer.from(randomBytes).toString('hex'));

    // Derive addresses from mnemonic
    const addresses = deriveAddressesFromMnemonic(
      mnemonic,
      accountIndex,
      DEFAULT_WALLET_DERIVATION_MODE
    );

    return {
      mnemonic,
      addresses,
    };
  } catch (error: unknown) {
    throw new Error('Failed to generate wallet: ' + (error as Error).message);
  }
};

/**
 * Validate and import a wallet from mnemonic
 * @param mnemonic - BIP39 mnemonic phrase (space-separated words)
 * @param accountIndex - Account index for derivation (default: 0)
 * @returns Promise with addresses
 */
export const importWallet = async (
  mnemonic: string,
  accountIndex = 0
): Promise<ImportWalletResult> => {
  assertValidAccountIndex(accountIndex);

  // Trim and normalize the mnemonic
  const normalizedMnemonic = mnemonic.trim().toLowerCase();

  // Validate the mnemonic
  if (!bip39.validateMnemonic(normalizedMnemonic)) {
    throw new Error('Invalid seed phrase. Please check and try again.');
  }

  // Derive addresses from mnemonic
  const addresses = deriveAddressesFromMnemonic(
    normalizedMnemonic,
    accountIndex,
    DEFAULT_WALLET_DERIVATION_MODE
  );

  return {
    addresses,
  };
};

/**
 * Load wallet from secure storage and derive addresses
 * Uses cached addresses for fast startup (~5ms vs ~200ms derivation)
 * @returns Promise with addresses and account index
 */
export const loadWalletFromStorage = async (): Promise<LoadWalletResult> => {
  try {
    startupDiagnostics.recordCheckpoint('wallet_storage_load_started');

    const accountIndex = await withRequiredSecureStoreRead(
      getCurrentAccount(),
      'getCurrentAccount'
    );
    startupDiagnostics.recordCheckpoint('wallet_current_account_loaded', {
      account_index: accountIndex,
    });

    const derivationMode = await withRequiredSecureStoreRead(
      getWalletDerivationMode(),
      'getWalletDerivationMode'
    );
    startupDiagnostics.recordCheckpoint('wallet_derivation_mode_loaded', {
      account_index: accountIndex,
      derivation_mode: derivationMode,
    });

    // Try multi-account cache first (instant if in memory)
    const multiCached = await withTimeout(
      getMultiAccountCache(accountIndex),
      SECURESTORE_READ_TIMEOUT_MS,
      null,
      'getMultiAccountCache'
    );
    if (multiCached) {
      startupDiagnostics.recordCheckpoint('wallet_multi_account_cache_hit', {
        account_index: accountIndex,
      });
      return { addresses: multiCached, accountIndex };
    }
    startupDiagnostics.recordCheckpoint('wallet_multi_account_cache_miss', {
      account_index: accountIndex,
    });

    // Try single-account cache (fast path - ~5ms)
    const cachedAddresses = await withTimeout(
      getCachedAddresses(accountIndex),
      SECURESTORE_READ_TIMEOUT_MS,
      null,
      'getCachedAddresses'
    );
    if (cachedAddresses) {
      startupDiagnostics.recordCheckpoint('wallet_cached_addresses_hit', {
        account_index: accountIndex,
      });
      // Populate multi-account cache for future fast switching (non-blocking with error logging)
      saveToMultiAccountCache(accountIndex, cachedAddresses).catch((error) => {
        logger.error('[walletService] Failed to save to multi-account cache during wallet load', {
          accountIndex,
          error: error instanceof Error ? error.message : String(error),
        });
      });
      return { addresses: cachedAddresses, accountIndex };
    }
    startupDiagnostics.recordCheckpoint('wallet_cached_addresses_miss', {
      account_index: accountIndex,
    });

    // Cache miss - derive addresses (slow path - ~200ms)
    let addresses;
    try {
      startupDiagnostics.recordCheckpoint('wallet_derivation_started', {
        account_index: accountIndex,
        derivation_mode: derivationMode,
      });
      addresses = await withMnemonic(async (mnemonic: string) => {
        if (!mnemonic) {
          return null;
        }
        return deriveAddressesFromMnemonic(mnemonic, accountIndex, derivationMode);
      });
      if (addresses) {
        startupDiagnostics.recordCheckpoint('wallet_addresses_derived', {
          account_index: accountIndex,
        });
      }
    } catch (error: unknown) {
      // "Mnemonic not found" means no wallet exists yet — return null instead of throwing
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('Mnemonic not found')) {
        startupDiagnostics.recordWarning('wallet_mnemonic_missing', {
          account_index: accountIndex,
        });
        return { addresses: null, accountIndex };
      }
      if (msg.includes('Passkey wallet is locked')) {
        startupDiagnostics.recordWarning('wallet_passkey_session_locked', {
          account_index: accountIndex,
        });
      }
      throw error;
    }

    // Cache the derived addresses for next startup and fast switching (non-blocking with error logging)
    if (addresses) {
      Promise.all([
        saveCachedAddresses(accountIndex, addresses),
        saveToMultiAccountCache(accountIndex, addresses),
      ]).catch((error) => {
        logger.error('[walletService] Failed to cache derived addresses after derivation', {
          accountIndex,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    return { addresses, accountIndex };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    startupDiagnostics.recordFailure('wallet_storage_load_failed', {
      error: errorMessage,
    });
    throw new Error('Failed to load wallet from storage: ' + errorMessage);
  }
};

/**
 * Switch to a different account in the HD wallet
 * Uses cache-first approach for fast switching (~5ms vs ~200ms derivation)
 * @param accountIndex - New account index
 * @returns Promise with addresses
 */
export const switchToAccount = async (accountIndex: number): Promise<SwitchAccountResult> => {
  try {
    assertValidAccountIndex(accountIndex);

    const derivationMode = await getWalletDerivationMode();

    // Try multi-account cache first (fast path - instant if in memory, ~5ms from storage)
    const cachedAddresses = await getMultiAccountCache(accountIndex);
    if (cachedAddresses) {
      // Persist current account before returning so storage-backed consumers stay in sync.
      await saveCurrentAccountOrThrow(accountIndex);
      return { addresses: cachedAddresses };
    }

    // Cache miss - derive addresses (slow path - ~200ms)
    const addresses = await withMnemonic(async (mnemonic: string) => {
      if (!mnemonic) {
        throw new Error('Failed to retrieve wallet from secure storage');
      }
      return deriveAddressesFromMnemonic(mnemonic, accountIndex, derivationMode);
    });

    // Save the new account index and cache the addresses for future fast switching
    await Promise.all([
      saveCurrentAccountOrThrow(accountIndex),
      saveCachedAddresses(accountIndex, addresses),
      saveToMultiAccountCache(accountIndex, addresses),
    ]);

    return { addresses };
  } catch (error: unknown) {
    throw new Error('Failed to switch account: ' + (error as Error).message);
  }
};

/**
 * Save wallet to secure storage
 * @param mnemonic - BIP39 mnemonic phrase
 * @param accountIndex - Account index
 * @throws Error if save fails (critical operation)
 */
export const saveWalletToStorage = async (mnemonic: string, accountIndex = 0): Promise<void> => {
  assertValidAccountIndex(accountIndex);

  await saveMnemonic(mnemonic);
  await setWalletDerivationMode(DEFAULT_WALLET_DERIVATION_MODE);
  await saveCurrentAccountOrThrow(accountIndex);
  const addresses = deriveAddressesFromMnemonic(
    mnemonic,
    accountIndex,
    DEFAULT_WALLET_DERIVATION_MODE
  );
  await Promise.all([
    saveCachedAddresses(accountIndex, addresses),
    saveToMultiAccountCache(accountIndex, addresses),
  ]);
};
