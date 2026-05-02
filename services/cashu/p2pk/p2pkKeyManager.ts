/**
 * P2PK Key Manager - Key caching and account lookup (NUT-11)
 */

import * as ecc from '@bitcoinerlab/secp256k1';
import { BIP32Factory } from 'bip32';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { Buffer } from 'buffer';
import { getDerivationPathForType } from '../../../constants/bitcoin';
import { deriveAddressesFromMnemonic,MUTINYNET_NETWORK } from '../../../utils/bitcoin';
import { logger } from '../../../utils/logger';
import { getPrivateKeyForAddress } from '../../../utils/wallet';
import { getCurrentAccount,withMnemonic } from '../../secureStorageService';
import { getWalletDerivationMode } from '../../walletDerivationService';

// In-memory cache for P2PK private key (never persisted to disk)
let cachedAddress: string | null = null;
let cachedPrivKey: string | null = null;

export interface AccountMatch {
  accountIndex: number;
  privateKey: string;
  address: string;
}

/**
 * Clear P2PK cache (call when switching accounts)
 */
export const clearP2PKCache = async (): Promise<void> => {
  cachedAddress = null;
  cachedPrivKey = null;
  logger.debug('[clearP2PKCache] Cleared P2PK cache');
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
    const derivationMode = await getWalletDerivationMode();

    // Initialize BIP32 (use top-level ecc import)
    const bip32 = BIP32Factory(ecc);

    // Convert mnemonic to seed once
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

    logger.info('[P2PK SCAN] Starting account scan', {
      targetPubkeyLength: recipientPubkey?.length,
      accountsToScan: accountsToCheck.length,
    });
    logger.debug('[findAccountForP2PKToken] Seed and root derived in', Date.now() - startTime, 'ms');

    // Check each account
    for (let idx = 0; idx < accountsToCheck.length; idx++) {
      const accountIndex = accountsToCheck[idx];

      try {
        // Report progress if callback provided
        if (onProgress) {
          onProgress(accountIndex, accountsToCheck.length);
        }
        // Derive taproot address for this account index
        // Using same derivation path as deriveAddressesFromMnemonic
        const taprootPath = getDerivationPathForType('taproot', accountIndex, derivationMode);
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

        // Compare tweaked output pubkeys (from Taproot addresses)
        if (outputPubkeyHex === recipientPubkey) {
          logger.cashu('p2pk_account_match_found', {
            step: 'ACCOUNT_MATCH',
            accountIndex,
            address: taprootPayment.address,
            scanTimeMs: Date.now() - startTime,
            accountsChecked: idx + 1,
          });

          // Compute tweaked private key (BIP-341 compliant)
          // Important: If the internal pubkey has odd Y, we must negate the private key first
          const tweak = bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey);
          let internalPrivkey = taprootChild.privateKey;
          if (!internalPrivkey) {
            throw new Error('Failed to derive internal private key');
          }

          // Check if we need to negate the internal private key
          // This is needed when the internal pubkey has an odd Y coordinate
          const internalPubkey = taprootChild.publicKey;
          const hasOddY = internalPubkey[0] === 0x03; // 0x03 prefix means odd Y

          if (hasOddY) {
            internalPrivkey = ecc.privateNegate(internalPrivkey);
            if (!internalPrivkey) {
              throw new Error('Failed to negate internal private key');
            }
          }

          const tweakedPrivkey = ecc.privateAdd(internalPrivkey, tweak);
          if (!tweakedPrivkey) {
            throw new Error('Failed to compute tweaked private key');
          }
          const tweakedPrivkeyHex = Buffer.from(tweakedPrivkey).toString('hex');

          // Verify the tweaked private key derives back to the expected pubkey
          const verifyPubkey = ecc.pointFromScalar(tweakedPrivkey);
          const verifyPubkeyXOnly = verifyPubkey
            ? Buffer.from(verifyPubkey).slice(1).toString('hex')
            : 'FAILED';

          if (verifyPubkeyXOnly !== recipientPubkey) {
            logger.error('[P2PK] Key derivation verification failed: pubkey mismatch', {
              accountIndex,
              expectedLength: recipientPubkey.length,
              derivedLength: verifyPubkeyXOnly.length,
            });
            throw new Error('P2PK key derivation verification failed: pubkey mismatch');
          }

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
    logger.warn('[P2PK SCAN] Target pubkey did not match scanned accounts', {
      targetPubkeyLength: recipientPubkey?.length,
    });
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
      targetPubkeyLength: recipientPubkey?.length,
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

  // Check in-memory cache
  if (cachedAddress && cachedPrivKey && cachedAddress === currentAddress) {
    logger.debug('[getP2PKPrivateKey] Using cached key (verified for current account)');
    return cachedPrivKey;
  } else if (cachedAddress && cachedAddress !== currentAddress) {
    logger.debug('[getP2PKPrivateKey] Cache invalid - address mismatch (account changed)');
    cachedAddress = null;
    cachedPrivKey = null;
  }

  logger.debug(`[getP2PKPrivateKey] Deriving private key for account ${accountIndex}...`);

  // Derive private key for current account - pass the account index to avoid searching
  const keyData = await getPrivateKeyForAddress(currentAddress, accountIndex);

  // Cache in memory only — private keys never touch disk
  cachedAddress = addresses.taprootAddress;
  cachedPrivKey = keyData.privateKey;
  logger.debug('[getP2PKPrivateKey] Cached address and key (memory only)');

  return keyData.privateKey;
};
