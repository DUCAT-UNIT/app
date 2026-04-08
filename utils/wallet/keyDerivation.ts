/**
 * Key derivation utilities for P2PK Cashu tokens
 *
 * Private keys are cached in-memory only (never persisted to disk).
 * Cache is cleared on app background, lock timeout, or explicit clear.
 */

import { Buffer } from 'buffer';
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Interface } from 'bip32';
import * as bip39 from 'bip39';
import { AppState, AppStateStatus } from 'react-native';
import { MUTINYNET_NETWORK } from '../bitcoin';
import { withMnemonic } from '../../services/secureStorageService';
import { getWalletDerivationMode } from '../../services/walletDerivationService';
import { logger } from '../logger';
import { bip32, ecc, getECPair, getDerivationPath } from './cryptoHelpers';

const CACHE_TTL_MS = 30 * 1000; // 30 seconds — matches inactivity lock timeout

export interface DerivedKeyData {
  privateKey: string;
  xOnlyPubkey: string;
  accountIndex: number;
}

interface CacheEntry {
  data: DerivedKeyData;
  expires: number;
}

// In-memory cache — private keys never touch disk
const memoryCache = new Map<string, CacheEntry>();

/**
 * Get private key and x-only pubkey for an address (for P2PK Cashu tokens)
 * Searches through accounts to find which one owns the address
 * @param address - Address (tb1p... or tb1q...)
 * @param knownAccountIndex - Optional: if we already know which account owns this address
 * @returns { privateKey: string, xOnlyPubkey: string, accountIndex: number }
 */
export async function getPrivateKeyForAddress(
  address: string,
  knownAccountIndex?: number
): Promise<DerivedKeyData> {
  const taprootPrefix = `${MUTINYNET_NETWORK.bech32}1p`;

  // Check in-memory cache
  const cached = memoryCache.get(address);
  if (cached && cached.expires > Date.now()) {
    logger.debug('[getPrivateKeyForAddress] Using cached key');
    return cached.data;
  }
  if (cached) {
    memoryCache.delete(address);
  }

  logger.debug('[getPrivateKeyForAddress] Cache miss, searching for account');

  const result = await withMnemonic(async (mnemonic: string) => {
    const derivationMode = await getWalletDerivationMode();
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

    // If we know the account index, try it directly first
    if (knownAccountIndex !== undefined) {
      logger.info(`[getPrivateKeyForAddress] Trying known account index: ${knownAccountIndex}`);
      const derivationPath = getDerivationPath(address, knownAccountIndex, derivationMode);
      const child = root.derivePath(derivationPath);

      if (address.toLowerCase().startsWith(taprootPrefix)) {
        const taprootResult = findTaprootAccount(child, address, knownAccountIndex, derivationPath);
        if (taprootResult) return taprootResult;
      } else {
        const segwitResult = findSegwitAccount(child, address, knownAccountIndex, derivationPath);
        if (segwitResult) return segwitResult;
      }
      logger.warn(`[getPrivateKeyForAddress] Known account ${knownAccountIndex} didn't match, falling back to search`);
    }

    // Dynamic scan range: at least 10 accounts, or more if we know of a higher account
    const maxAccounts = Math.max(10, (knownAccountIndex || 0) + 5);
    logger.info(`[getPrivateKeyForAddress] Searching up to ${maxAccounts} accounts`);

    for (let accountIndex = 0; accountIndex < maxAccounts; accountIndex++) {
      // Skip the known account index if we already tried it
      if (knownAccountIndex !== undefined && accountIndex === knownAccountIndex) {
        continue;
      }

      const derivationPath = getDerivationPath(address, accountIndex, derivationMode);
      const child = root.derivePath(derivationPath);

      if (address.toLowerCase().startsWith(taprootPrefix)) {
        const taprootResult = findTaprootAccount(child, address, accountIndex, derivationPath);
        if (taprootResult) return taprootResult;
      } else {
        const segwitResult = findSegwitAccount(child, address, accountIndex, derivationPath);
        if (segwitResult) return segwitResult;
      }
    }

    throw new Error(`Address ${address} not found in first ${maxAccounts} accounts`);
  });

  // Cache in memory only — never persisted to disk
  memoryCache.set(address, {
    data: result,
    expires: Date.now() + CACHE_TTL_MS,
  });
  logger.debug('[getPrivateKeyForAddress] Cached key (memory only)');

  return result;
}

/**
 * Check if a Taproot account matches the address
 */
function findTaprootAccount(
  child: BIP32Interface,
  address: string,
  accountIndex: number,
  derivationPath: string
): DerivedKeyData | null {
  const xOnlyPubkey = Buffer.from(child.publicKey.slice(1, 33));
  const payment = bitcoin.payments.p2tr({
    internalPubkey: xOnlyPubkey,
    network: MUTINYNET_NETWORK,
  });

  if (payment.address !== address) {
    return null;
  }

  // Found matching account - compute tweaked keys
  const outputPubkey = payment.pubkey || Buffer.alloc(0);
  const outputPubkeyHex = outputPubkey.toString('hex');

  // Compute tweaked private key (BIP-341 compliant)
  // Important: If the internal pubkey has odd Y, we must negate the private key first
  const tweak = bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey);
  let internalPrivkey = Buffer.from(child.privateKey!);

  // Check if we need to negate the internal private key
  // This is needed when the internal pubkey has an odd Y coordinate
  const hasOddY = child.publicKey[0] === 0x03; // 0x03 prefix means odd Y

  if (hasOddY) {
    // Negate the private key
    const negatedPrivkey = ecc.privateNegate(internalPrivkey);
    if (!negatedPrivkey) {
      throw new Error('Failed to negate internal private key');
    }
    internalPrivkey = Buffer.from(negatedPrivkey);
    logger.debug('[findTaprootAccount] Negated internal private key (odd Y coordinate)');
  }

  const tweakedPrivkey = ecc.privateAdd(internalPrivkey, tweak);
  if (!tweakedPrivkey) {
    throw new Error('Failed to compute tweaked Taproot private key');
  }
  const tweakedPrivkeyHex = Buffer.from(tweakedPrivkey).toString('hex');

  logger.debug('[getPrivateKeyForAddress] Found Taproot account:', {
    accountIndex,
    address,
    derivationPath,
  });

  return {
    privateKey: tweakedPrivkeyHex,
    xOnlyPubkey: outputPubkeyHex,
    accountIndex,
  };
}

/**
 * Check if a SegWit account matches the address
 */
function findSegwitAccount(
  child: BIP32Interface,
  address: string,
  accountIndex: number,
  derivationPath: string
): DerivedKeyData | null {
  const ECPairInstance = getECPair();
  const keyPair = ECPairInstance.fromPrivateKey(child.privateKey!, { network: MUTINYNET_NETWORK });
  const payment = bitcoin.payments.p2wpkh({
    pubkey: keyPair.publicKey,
    network: MUTINYNET_NETWORK,
  });

  if (payment.address !== address) {
    return null;
  }

  const privateKeyHex = Buffer.from(child.privateKey!).toString('hex');
  const pubkeyHex = Buffer.from(keyPair.publicKey).toString('hex');

  logger.debug('[getPrivateKeyForAddress] Found SegWit account:', {
    accountIndex,
    address,
    derivationPath,
  });

  return {
    privateKey: privateKeyHex,
    xOnlyPubkey: pubkeyHex,
    accountIndex,
  };
}

/**
 * Purge expired entries from the in-memory cache
 */
export async function purgeExpiredKeys(): Promise<void> {
  const now = Date.now();
  let removed = 0;
  for (const [key, entry] of memoryCache) {
    if (entry.expires <= now) {
      memoryCache.delete(key);
      removed++;
    }
  }
  if (removed > 0) {
    logger.debug('[purgeExpiredKeys] Purge complete', {
      removed,
      remaining: memoryCache.size,
    });
  }
}

/**
 * Clear all cached derived keys from memory
 */
export async function clearAllDerivedKeys(): Promise<void> {
  const count = memoryCache.size;
  memoryCache.clear();
  logger.info('[clearAllDerivedKeys] Cleared all derived keys', { count });
}

let appStateSubscription: { remove: () => void } | null = null;

const handleAppStateChange = (state: AppStateStatus): void => {
  if (state === 'active') {
    purgeExpiredKeys().catch((error: unknown) => {
      logger.warn('Failed to purge expired derived keys on app active', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
};

export function startDerivedKeyCacheLifecycle(): void {
  if (appStateSubscription) {
    return;
  }

  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
}

export function stopDerivedKeyCacheLifecycle(): void {
  appStateSubscription?.remove();
  appStateSubscription = null;
}
