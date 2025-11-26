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
const DERIVED_KEY_VERSION = 'v4_';
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
 * @returns { privateKey: string, xOnlyPubkey: string, accountIndex: number }
 */
export async function getPrivateKeyForAddress(address: string): Promise<DerivedKeyData> {
  const cacheKey = `${DERIVED_KEY_PREFIX}${address}`;

  // Check cache first
  try {
    const cached = await SecureStore.getItemAsync(cacheKey);
    if (cached) {
      logger.debug('[getPrivateKeyForAddress] Using cached key');
      return JSON.parse(cached) as DerivedKeyData;
    }
  } catch (error) {
    logger.warn('[getPrivateKeyForAddress] Failed to read cache:', { error: (error as Error).message });
  }

  logger.debug('[getPrivateKeyForAddress] Cache miss, searching for account');

  const result = await withMnemonic(async (mnemonic: string) => {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

    // Search up to 50 accounts
    for (let accountIndex = 0; accountIndex < 50; accountIndex++) {
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

    throw new Error(`Address ${address} not found in first 50 accounts`);
  });

  // Cache the result
  try {
    await SecureStore.setItemAsync(cacheKey, JSON.stringify(result));
    logger.debug('[getPrivateKeyForAddress] Cached key');
  } catch (error) {
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

  // Compute tweaked private key
  const tweak = bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey);
  const internalPrivkey = Buffer.from(child.privateKey!);
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
