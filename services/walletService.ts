/**
 * Wallet Service - Wallet creation, import, and management
 */

import { Buffer } from 'buffer';
import * as Crypto from 'expo-crypto';
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as bip39 from 'bip39';
import * as ecc from '@bitcoinerlab/secp256k1';
import {
  deriveAddressesFromMnemonic,
  MUTINYNET_NETWORK,
  type DerivedAddresses,
} from '../utils/bitcoin';
import {
  DEFAULT_WALLET_DERIVATION_MODE,
  UNISAT_WALLET_DERIVATION_MODE,
  XVERSE_WALLET_DERIVATION_MODE,
  getDerivationPathForType,
  type WalletDerivationMode,
} from '../constants/bitcoin';
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
const bip32 = BIP32Factory(ecc);
type Bip32Root = ReturnType<typeof bip32.fromSeed>;

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

export type WalletAddressMatchType = 'legacy' | 'segwit' | 'taproot';

export interface FindWalletAccountResult {
  accountIndex: number;
  derivationMode: WalletDerivationMode;
  addresses: DerivedAddresses;
  matchedAddressType: WalletAddressMatchType;
}

export interface WalletAccountAddresses {
  accountIndex: number;
  derivationMode: WalletDerivationMode;
  addresses: DerivedAddresses;
}

export const QUANTA_DISCOVERY_DERIVATION_MODES: readonly WalletDerivationMode[] = [
  XVERSE_WALLET_DERIVATION_MODE,
  UNISAT_WALLET_DERIVATION_MODE,
];

const saveCurrentAccountOrThrow = async (accountIndex: number): Promise<void> => {
  const saved = await saveCurrentAccount(accountIndex);
  if (!saved) {
    throw new Error('Failed to save current account securely');
  }
};

const deriveAddressesFromRoot = (
  root: Bip32Root,
  accountIndex: number,
  derivationMode: WalletDerivationMode
): DerivedAddresses => {
  const legacyChild = root.derivePath(
    getDerivationPathForType('legacy', accountIndex, derivationMode)
  );
  const legacyPubkey = Buffer.from(legacyChild.publicKey);
  const legacyPayment = bitcoin.payments.p2sh({
    redeem: bitcoin.payments.p2wpkh({
      pubkey: legacyPubkey,
      network: MUTINYNET_NETWORK,
    }),
    network: MUTINYNET_NETWORK,
  });

  const segwitChild = root.derivePath(
    getDerivationPathForType('segwit', accountIndex, derivationMode)
  );
  const segwitPubkey = Buffer.from(segwitChild.publicKey);
  const segwitPayment = bitcoin.payments.p2wpkh({
    pubkey: segwitPubkey,
    network: MUTINYNET_NETWORK,
  });

  const taprootChild = root.derivePath(
    getDerivationPathForType('taproot', accountIndex, derivationMode)
  );
  const xOnlyPubkey = Buffer.from(taprootChild.publicKey.slice(1, 33));
  const taprootPayment = bitcoin.payments.p2tr({
    internalPubkey: xOnlyPubkey,
    network: MUTINYNET_NETWORK,
  });

  if (!legacyPayment.address) {
    throw new Error('Failed to generate nested SegWit address from public key');
  }
  if (!segwitPayment.address) {
    throw new Error('Failed to generate SegWit address from public key');
  }
  if (!taprootPayment.address) {
    throw new Error('Failed to generate Taproot address from public key');
  }

  return {
    legacyAddress: legacyPayment.address,
    segwitAddress: segwitPayment.address,
    taprootAddress: taprootPayment.address,
    legacyPubkey: legacyPubkey.toString('hex'),
    segwitPubkey: segwitPubkey.toString('hex'),
    taprootPubkey: xOnlyPubkey.toString('hex'),
  };
};

const assertValidAccountIndex = (accountIndex: number): void => {
  if (!Number.isSafeInteger(accountIndex) || accountIndex < 0) {
    throw new Error(`Invalid account index: ${accountIndex}`);
  }
};

const getWalletAddressMatchType = (
  addresses: DerivedAddresses,
  normalizedAddress: string
): WalletAddressMatchType | null => {
  if (addresses.legacyAddress?.toLowerCase() === normalizedAddress) {
    return 'legacy';
  }

  if (addresses.segwitAddress.toLowerCase() === normalizedAddress) {
    return 'segwit';
  }

  if (addresses.taprootAddress.toLowerCase() === normalizedAddress) {
    return 'taproot';
  }

  return null;
};

const hasLegacyPaymentAddress = (addresses: DerivedAddresses): boolean =>
  typeof addresses.legacyAddress === 'string' && addresses.legacyAddress.length > 0;

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
  accountIndex = 0,
  derivationMode: WalletDerivationMode = DEFAULT_WALLET_DERIVATION_MODE
): Promise<ImportWalletResult> => {
  assertValidAccountIndex(accountIndex);

  // Trim and normalize the mnemonic
  const normalizedMnemonic = mnemonic.trim().toLowerCase();

  // Validate the mnemonic
  if (!bip39.validateMnemonic(normalizedMnemonic)) {
    throw new Error('Invalid seed phrase. Please check and try again.');
  }

  // Derive addresses from mnemonic
  const addresses = deriveAddressesFromMnemonic(normalizedMnemonic, accountIndex, derivationMode);

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
      getMultiAccountCache(accountIndex, derivationMode),
      SECURESTORE_READ_TIMEOUT_MS,
      null,
      'getMultiAccountCache'
    );
    if (multiCached) {
      startupDiagnostics.recordCheckpoint('wallet_multi_account_cache_hit', {
        account_index: accountIndex,
      });
      if (hasLegacyPaymentAddress(multiCached)) {
        return { addresses: multiCached, accountIndex };
      }
      startupDiagnostics.recordWarning('wallet_multi_account_cache_stale', {
        account_index: accountIndex,
      });
    }
    startupDiagnostics.recordCheckpoint('wallet_multi_account_cache_miss', {
      account_index: accountIndex,
    });

    // Try single-account cache (fast path - ~5ms)
    const cachedAddresses = await withTimeout(
      getCachedAddresses(accountIndex, derivationMode),
      SECURESTORE_READ_TIMEOUT_MS,
      null,
      'getCachedAddresses'
    );
    if (cachedAddresses) {
      startupDiagnostics.recordCheckpoint('wallet_cached_addresses_hit', {
        account_index: accountIndex,
      });
      if (!hasLegacyPaymentAddress(cachedAddresses)) {
        startupDiagnostics.recordWarning('wallet_cached_addresses_stale', {
          account_index: accountIndex,
        });
      } else {
        // Populate multi-account cache for future fast switching (non-blocking with error logging)
        saveToMultiAccountCache(accountIndex, cachedAddresses, derivationMode).catch((error) => {
          logger.error('[walletService] Failed to save to multi-account cache during wallet load', {
            accountIndex,
            error: error instanceof Error ? error.message : String(error),
          });
        });
        return { addresses: cachedAddresses, accountIndex };
      }
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
        saveCachedAddresses(accountIndex, addresses, derivationMode),
        saveToMultiAccountCache(accountIndex, addresses, derivationMode),
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
    const cachedAddresses = await getMultiAccountCache(accountIndex, derivationMode);
    if (cachedAddresses && hasLegacyPaymentAddress(cachedAddresses)) {
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
      saveCachedAddresses(accountIndex, addresses, derivationMode),
      saveToMultiAccountCache(accountIndex, addresses, derivationMode),
    ]);

    return { addresses };
  } catch (error: unknown) {
    throw new Error('Failed to switch account: ' + (error as Error).message);
  }
};

const findAccountBySegwitOrTaprootAddress = async (
  walletAddress: string,
  searchLimit = 100,
  derivationModes: readonly WalletDerivationMode[] = QUANTA_DISCOVERY_DERIVATION_MODES
): Promise<FindWalletAccountResult | null> => {
  const normalizedAddress = walletAddress.trim().toLowerCase();
  if (!normalizedAddress) {
    return null;
  }
  if (!Number.isSafeInteger(searchLimit) || searchLimit <= 0) {
    throw new Error(`Invalid account search limit: ${searchLimit}`);
  }

  for (const derivationMode of derivationModes) {
    for (let accountIndex = 0; accountIndex < searchLimit; accountIndex += 1) {
      const cachedAddresses = await getMultiAccountCache(accountIndex, derivationMode);
      if (cachedAddresses) {
        const matchedAddressType = getWalletAddressMatchType(cachedAddresses, normalizedAddress);
        if (matchedAddressType) {
          return { accountIndex, derivationMode, addresses: cachedAddresses, matchedAddressType };
        }
      }
    }
  }

  return withMnemonic(async (mnemonic: string) => {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

    for (const derivationMode of derivationModes) {
      for (let accountIndex = 0; accountIndex < searchLimit; accountIndex += 1) {
        const addresses = deriveAddressesFromRoot(root, accountIndex, derivationMode);
        const matchedAddressType = getWalletAddressMatchType(addresses, normalizedAddress);

        if (matchedAddressType) {
          return { accountIndex, derivationMode, addresses, matchedAddressType };
        }
      }
    }

    return null;
  });
};

export const findAccountByWalletAddress = findAccountBySegwitOrTaprootAddress;

export const deriveWalletAccounts = async (
  searchLimit = 100,
  derivationModes: readonly WalletDerivationMode[] = QUANTA_DISCOVERY_DERIVATION_MODES
): Promise<WalletAccountAddresses[]> => {
  if (!Number.isSafeInteger(searchLimit) || searchLimit <= 0) {
    throw new Error(`Invalid account search limit: ${searchLimit}`);
  }

  return withMnemonic(async (mnemonic: string) => {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);
    const accounts: WalletAccountAddresses[] = [];

    for (let accountIndex = 0; accountIndex < searchLimit; accountIndex += 1) {
      derivationModes.forEach((derivationMode) => {
        accounts.push({
          accountIndex,
          derivationMode,
          addresses: deriveAddressesFromRoot(root, accountIndex, derivationMode),
        });
      });
    }

    return accounts;
  });
};

/**
 * Save wallet to secure storage
 * @param mnemonic - BIP39 mnemonic phrase
 * @param accountIndex - Account index
 * @throws Error if save fails (critical operation)
 */
export const saveWalletToStorage = async (
  mnemonic: string,
  accountIndex = 0,
  derivationMode: WalletDerivationMode = DEFAULT_WALLET_DERIVATION_MODE
): Promise<void> => {
  assertValidAccountIndex(accountIndex);

  await saveMnemonic(mnemonic);
  await setWalletDerivationMode(derivationMode);
  await saveCurrentAccountOrThrow(accountIndex);
  const addresses = deriveAddressesFromMnemonic(mnemonic, accountIndex, derivationMode);
  await Promise.all([
    saveCachedAddresses(accountIndex, addresses, derivationMode),
    saveToMultiAccountCache(accountIndex, addresses, derivationMode),
  ]);
};
