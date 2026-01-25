/**
 * Key derivation utilities for P2PK Cashu tokens
 */

import { Buffer } from 'buffer';
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Interface } from 'bip32';
import * as bip39 from 'bip39';
import * as SecureStore from 'expo-secure-store';
import { MUTINYNET_NETWORK } from '../bitcoin';
import { withMnemonic } from '../../services/secureStorageService';
import { logger } from '../logger';
import { bip32, ecc, getECPair, getDerivationPath } from './cryptoHelpers';

// SecureStore key prefix for derived keys
// v5: Fixed BIP-341 parity handling for odd Y coordinate pubkeys
const DERIVED_KEY_VERSION = 'v5_';
const DERIVED_KEY_PREFIX = 'derived_key_' + DERIVED_KEY_VERSION;

export interface DerivedKeyData {
  privateKey: string;
  xOnlyPubkey: string;
  accountIndex: number;
}

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
  const cacheKey = `${DERIVED_KEY_PREFIX}${address}`;

  // Check cache first
  try {
    const cached = await SecureStore.getItemAsync(cacheKey);
    if (cached) {
      logger.debug('[getPrivateKeyForAddress] Using cached key');
      return JSON.parse(cached) as DerivedKeyData;
    }
  } catch (error: unknown) {
    logger.warn('[getPrivateKeyForAddress] Failed to read cache:', { error: (error as Error).message });
  }

  logger.debug('[getPrivateKeyForAddress] Cache miss, searching for account');

  const result = await withMnemonic(async (mnemonic: string) => {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

    // If we know the account index, try it directly first
    if (knownAccountIndex !== undefined) {
      logger.info(`[getPrivateKeyForAddress] Trying known account index: ${knownAccountIndex}`);
      const derivationPath = getDerivationPath(address, knownAccountIndex);
      const child = root.derivePath(derivationPath);

      if (address.startsWith('tb1p')) {
        const taprootResult = findTaprootAccount(child, address, knownAccountIndex, derivationPath);
        if (taprootResult) return taprootResult;
      } else {
        const segwitResult = findSegwitAccount(child, address, knownAccountIndex, derivationPath);
        if (segwitResult) return segwitResult;
      }
      logger.warn(`[getPrivateKeyForAddress] Known account ${knownAccountIndex} didn't match, falling back to search`);
    }

    // Dynamic scan range: at least 100 accounts, or more if we know of a higher account
    const maxAccounts = Math.max(100, (knownAccountIndex || 0) + 10);
    logger.info(`[getPrivateKeyForAddress] Searching up to ${maxAccounts} accounts`);

    for (let accountIndex = 0; accountIndex < maxAccounts; accountIndex++) {
      // Skip the known account index if we already tried it
      if (knownAccountIndex !== undefined && accountIndex === knownAccountIndex) {
        continue;
      }

      const derivationPath = getDerivationPath(address, accountIndex);
      const child = root.derivePath(derivationPath);

      if (address.startsWith('tb1p')) {
        const taprootResult = findTaprootAccount(child, address, accountIndex, derivationPath);
        if (taprootResult) return taprootResult;
      } else {
        const segwitResult = findSegwitAccount(child, address, accountIndex, derivationPath);
        if (segwitResult) return segwitResult;
      }
    }

    throw new Error(`Address ${address} not found in first ${maxAccounts} accounts`);
  });

  // Cache the result
  try {
    await SecureStore.setItemAsync(cacheKey, JSON.stringify(result));
    logger.debug('[getPrivateKeyForAddress] Cached key');
  } catch (error: unknown) {
    logger.warn('[getPrivateKeyForAddress] Failed to cache:', { error: (error as Error).message });
  }

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
  const tweakedPrivkeyHex = Buffer.from(tweakedPrivkey!).toString('hex');

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
