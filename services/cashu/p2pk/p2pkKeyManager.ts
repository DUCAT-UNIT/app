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
  } catch (error: unknown) {
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
  // Scan range: max(maxAccounts, currentAccountIndex + 1) to ensure we check all accounts
  // up to and including the current account
  const scanRange = Math.max(maxAccounts, currentAccountIndex + 1);
  const accountsToCheck: number[] = [currentAccountIndex];
  for (let i = 0; i < scanRange; i++) {
    if (i !== currentAccountIndex) {
      accountsToCheck.push(i);
    }
  }

  logger.cashu('p2pk_accounts_to_check', {
    step: 'ACCOUNT_MATCH',
    currentAccountIndex,
    scanRange,
    totalAccountsToCheck: accountsToCheck.length,
    message: currentAccountIndex >= maxAccounts
      ? `Current account ${currentAccountIndex} extends scan range to ${scanRange}`
      : `Using default scan range of ${maxAccounts}`,
  });

  // Derive ALL keys in a single withMnemonic call for maximum performance
  const result = await withMnemonic<AccountMatch | null>(async (mnemonic) => {
    const startTime = Date.now();

    // Initialize BIP32 (use top-level ecc import)
    const bip32 = BIP32Factory(ecc);

    // Convert mnemonic to seed once
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

    logger.info(`[P2PK SCAN] 🔍 Starting scan for pubkey: ${recipientPubkey}`);
    logger.info(`[P2PK SCAN] 📊 Pubkey length: ${recipientPubkey?.length}, Accounts to scan: ${accountsToCheck.length}`);
    logger.debug('[findAccountForP2PKToken] Seed and root derived in', Date.now() - startTime, 'ms');

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

        // Log every 10th account or specific accounts for debugging
        const isCurrentAccount = accountIndex === currentAccountIndex;
        const isHighAccount = accountIndex >= 80;
        const shouldLogDetailed = isCurrentAccount || isHighAccount || accountIndex % 20 === 0;

        if (shouldLogDetailed) {
          logger.info(`[P2PK SCAN] Account ${accountIndex}${isCurrentAccount ? ' (CURRENT)' : ''}:`);
          logger.info(`  Path: ${taprootPath}`);
          logger.info(`  Address: ${taprootPayment.address}`);
          logger.info(`  Derived pubkey:  ${outputPubkeyHex}`);
          logger.info(`  Target pubkey:   ${recipientPubkey}`);
          logger.info(`  Match: ${outputPubkeyHex === recipientPubkey ? '✅ YES!' : '❌ No'}`);
          if (outputPubkeyHex.length !== recipientPubkey.length) {
            logger.warn(`  ⚠️ LENGTH MISMATCH: derived=${outputPubkeyHex.length} vs target=${recipientPubkey.length}`);
          }
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
      } catch (error: unknown) {
        logger.cashu('p2pk_account_check_error', {
          step: 'ACCOUNT_MATCH',
          accountIndex,
          error: (error as Error).message,
        });
        continue;
      }
    }

    logger.warn(`[P2PK SCAN] ❌ NO MATCH FOUND after scanning ${accountsToCheck.length} accounts`);
    logger.warn(`[P2PK SCAN] Target pubkey was: ${recipientPubkey}`);
    logger.warn(`[P2PK SCAN] Scan took ${Date.now() - startTime}ms`);
    logger.cashu('p2pk_account_search_complete', {
      step: 'ACCOUNT_MATCH',
      found: false,
      accountsChecked: accountsToCheck.length,
      scanTimeMs: Date.now() - startTime,
    });
    return null;
  });

  if (!result) {
    logger.warn('[P2PK SCAN] ⚠️ Token does not belong to any scanned account');
    logger.warn(`[P2PK SCAN] Scanned accounts 0-${scanRange - 1} (total: ${accountsToCheck.length})`);
    logger.warn(`[P2PK SCAN] Current account was: ${currentAccountIndex}`);
    logger.cashu('p2pk_no_matching_account', {
      step: 'ACCOUNT_MATCH',
      accountsChecked: accountsToCheck.length,
      scanRange,
      currentAccountIndex,
      targetPubkey: recipientPubkey,
      message: 'Token does not belong to any scanned account',
    });
  } else {
    logger.info(`[P2PK SCAN] ✅ MATCH FOUND! Account ${result.accountIndex}, Address: ${result.address}`);
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
  } catch (error: unknown) {
    logger.warn('[getP2PKPrivateKey] Cache read failed', { error: (error as Error).message });
  }

  logger.debug(`[getP2PKPrivateKey] Deriving private key for account ${accountIndex}...`);

  // Derive private key for current account - pass the account index to avoid searching
  const keyData = await getPrivateKeyForAddress(currentAddress, accountIndex);

  // Cache both for next time
  try {
    await SecureStore.setItemAsync(CACHE_KEY_ADDRESS, addresses.taprootAddress);
    await SecureStore.setItemAsync(CACHE_KEY_PRIVKEY, keyData.privateKey);
    logger.debug('[getP2PKPrivateKey] Cached address and key');
  } catch (error: unknown) {
    logger.warn('[getP2PKPrivateKey] Cache write failed', { error: (error as Error).message });
  }

  return keyData.privateKey;
};
