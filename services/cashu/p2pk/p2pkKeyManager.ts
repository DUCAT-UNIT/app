/**
 * P2PK Key Manager - Key caching and account lookup (NUT-11)
 */

import { Buffer } from 'buffer';
import * as ecc from '@bitcoinerlab/secp256k1';
import * as SecureStore from 'expo-secure-store';
import { BIP32Factory } from 'bip32';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { logger } from '../../../utils/logger';
import { withMnemonic, getCurrentAccount } from '../../secureStorageService';
import { deriveAddressesFromMnemonic, MUTINYNET_NETWORK } from '../../../utils/bitcoin';
import { getPrivateKeyForAddress } from '../../../utils/wallet';

// Cache keys for P2PK private key (cleared when account changes)
const CACHE_KEY_ADDRESS = 'p2pk_taproot_address_v3';  // v3: now uses tweaked pubkeys
const CACHE_KEY_PRIVKEY = 'p2pk_private_key_v3';       // v3: now uses tweaked privkeys

export interface AccountMatch {
  accountIndex: number;
  privateKey: string;
  address: string;
}

/**
 * Clear P2PK cache (call when switching accounts)
 */
export const clearP2PKCache = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(CACHE_KEY_ADDRESS);
    await SecureStore.deleteItemAsync(CACHE_KEY_PRIVKEY);
    logger.debug('[clearP2PKCache] Cleared P2PK cache');
  } catch (error) {
    logger.warn('[clearP2PKCache] Failed to clear cache', { error: (error as Error).message });
  }
};

/**
 * Find which account a P2PK token is locked to by scanning derivation paths
 * Optimized to derive all keys in a single withMnemonic call
 * @param recipientPubkey - The public key the token is locked to (hex)
 * @param maxAccounts - Maximum number of accounts to check (default: 50)
 * @param onProgress - Optional callback to report progress (accountIndex, total)
 */
export const findAccountForP2PKToken = async (
  recipientPubkey: string,
  maxAccounts = 50,
  onProgress: ((accountIndex: number, total: number) => void) | null = null
): Promise<AccountMatch | null> => {
  logger.cashu('p2pk_account_search_start', {
    step: 'ACCOUNT_MATCH',
    targetPubkey: recipientPubkey?.substring(0, 16) + '...',
    targetPubkeyLength: recipientPubkey?.length,
    maxAccounts,
  });

  // Get current account to check it first (most likely match)
  const currentAccountIndex = await getCurrentAccount();
  logger.cashu('p2pk_current_account', {
    step: 'ACCOUNT_MATCH',
    currentAccountIndex,
    message: 'Will check current account first',
  });

  // Build list of account indices to check, starting with current account
  const accountsToCheck = [currentAccountIndex];
  for (let i = 0; i < maxAccounts; i++) {
    if (i !== currentAccountIndex) {
      accountsToCheck.push(i);
    }
  }

  // Derive ALL keys in a single withMnemonic call for maximum performance
  const result = await withMnemonic<AccountMatch | null>(async (mnemonic) => {
    const startTime = Date.now();

    // Initialize BIP32 (use top-level ecc import)
    const bip32 = BIP32Factory(ecc);

    // Convert mnemonic to seed once
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

    logger.debug('[findAccountForP2PKToken] Seed and root derived in', Date.now() - startTime, 'ms');
    logger.debug('[findAccountForP2PKToken] Looking for pubkey:', recipientPubkey);

    // Check each account
    for (let idx = 0; idx < accountsToCheck.length; idx++) {
      const accountIndex = accountsToCheck[idx];

      try {
        // Report progress if callback provided
        if (onProgress) {
          onProgress(accountIndex, accountsToCheck.length);
        }

        const checkStart = Date.now();

        // Derive taproot address for this account index
        // Using same derivation path as deriveAddressesFromMnemonic
        const taprootPath = `m/86'/1'/0'/0/${accountIndex}`;
        const taprootChild = root.derivePath(taprootPath);
        const xOnlyPubkey = taprootChild.publicKey.slice(1, 33);

        // Derive address and get tweaked output pubkey
        const taprootPayment = bitcoin.payments.p2tr({
          internalPubkey: xOnlyPubkey,
          network: MUTINYNET_NETWORK,
        });

        // Extract tweaked output pubkey from payment (what's in the address)
        // For P2TR, pubkey is already 32-byte x-only pubkey (not 33-byte compressed with prefix)
        const outputPubkey = taprootPayment.pubkey ? taprootPayment.pubkey : Buffer.alloc(0);
        const outputPubkeyHex = Buffer.from(outputPubkey).toString('hex');

        logger.debug(`[findAccountForP2PKToken] Account ${accountIndex}: output_pubkey=${outputPubkeyHex.substring(0, 16)}... addr=${taprootPayment.address} (${Date.now() - checkStart}ms)`);

        // Show full comparison for account 4 & 5 to debug
        if (accountIndex === 4 || accountIndex === 5) {
          logger.debug(`[findAccountForP2PKToken] 🔍 Account ${accountIndex} FULL COMPARISON:`);
          logger.debug('  Derived output pubkey:', outputPubkeyHex);
          logger.debug('  Looking for          :', recipientPubkey);
          logger.debug('  Match?               :', outputPubkeyHex === recipientPubkey);
          logger.debug('  Lengths              :', outputPubkeyHex.length, 'vs', recipientPubkey.length);
        }

        // Compare tweaked output pubkeys (from Taproot addresses)
        if (outputPubkeyHex === recipientPubkey) {
          logger.cashu('p2pk_account_match_found', {
            step: 'ACCOUNT_MATCH',
            accountIndex,
            address: taprootPayment.address,
            derivedPubkey: outputPubkeyHex?.substring(0, 16) + '...',
            targetPubkey: recipientPubkey?.substring(0, 16) + '...',
            scanTimeMs: Date.now() - startTime,
            accountsChecked: idx + 1,
          });

          // Compute tweaked private key
          const tweak = bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey);
          const internalPrivkey = taprootChild.privateKey;
          if (!internalPrivkey) {
            throw new Error('Failed to derive internal private key');
          }
          const tweakedPrivkey = ecc.privateAdd(internalPrivkey, tweak);
          if (!tweakedPrivkey) {
            throw new Error('Failed to compute tweaked private key');
          }
          const tweakedPrivkeyHex = Buffer.from(tweakedPrivkey).toString('hex');

          logger.cashu('p2pk_private_key_derived', {
            step: 'ACCOUNT_MATCH',
            accountIndex,
            privateKeyLength: tweakedPrivkeyHex?.length,
            message: 'Tweaked private key derived successfully',
          });

          return {
            accountIndex,
            privateKey: tweakedPrivkeyHex,
            address: taprootPayment.address || '',
          };
        }
      } catch (error) {
        logger.cashu('p2pk_account_check_error', {
          step: 'ACCOUNT_MATCH',
          accountIndex,
          error: (error as Error).message,
        });
        continue;
      }
    }

    logger.cashu('p2pk_account_search_complete', {
      step: 'ACCOUNT_MATCH',
      found: false,
      accountsChecked: accountsToCheck.length,
      scanTimeMs: Date.now() - startTime,
    });
    return null;
  });

  if (!result) {
    logger.cashu('p2pk_no_matching_account', {
      step: 'ACCOUNT_MATCH',
      accountsChecked: accountsToCheck.length,
      targetPubkey: recipientPubkey?.substring(0, 16) + '...',
      message: 'Token does not belong to any scanned account',
    });
  }

  return result;
};

/**
 * Get P2PK private key for current wallet (cached for performance)
 * Caches both the taproot address and derived private key
 * @returns Private key hex
 */
export const getP2PKPrivateKey = async (): Promise<string> => {
  // Get current account's address to verify cache
  const accountIndex = await getCurrentAccount();
  const addresses = await withMnemonic(async (mnemonic) => {
    return deriveAddressesFromMnemonic(mnemonic, accountIndex);
  });
  const currentAddress = addresses.taprootAddress;

  // Try to get both from cache
  try {
    const cachedAddress = await SecureStore.getItemAsync(CACHE_KEY_ADDRESS);
    const cachedPrivKey = await SecureStore.getItemAsync(CACHE_KEY_PRIVKEY);

    // Verify cached address matches current account before using cached key
    if (cachedAddress && cachedPrivKey && cachedAddress === currentAddress) {
      logger.debug('[getP2PKPrivateKey] Using cached key (verified for current account)');
      return cachedPrivKey;
    } else if (cachedAddress && cachedAddress !== currentAddress) {
      logger.debug('[getP2PKPrivateKey] Cache invalid - address mismatch (account changed)');
      // Clear stale cache
      await SecureStore.deleteItemAsync(CACHE_KEY_ADDRESS);
      await SecureStore.deleteItemAsync(CACHE_KEY_PRIVKEY);
    }
  } catch (error) {
    logger.warn('[getP2PKPrivateKey] Cache read failed', { error: (error as Error).message });
  }

  logger.debug('[getP2PKPrivateKey] Deriving private key for current account...');

  // Derive private key for current account
  const keyData = await getPrivateKeyForAddress(currentAddress);

  // Cache both for next time
  try {
    await SecureStore.setItemAsync(CACHE_KEY_ADDRESS, addresses.taprootAddress);
    await SecureStore.setItemAsync(CACHE_KEY_PRIVKEY, keyData.privateKey);
    logger.debug('[getP2PKPrivateKey] Cached address and key');
  } catch (error) {
    logger.warn('[getP2PKPrivateKey] Cache write failed', { error: (error as Error).message });
  }

  return keyData.privateKey;
};
