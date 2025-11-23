import * as crypto from 'expo-crypto';
import { Buffer } from 'buffer';
import { schnorr } from '@noble/secp256k1';
import * as ecc from '@bitcoinerlab/secp256k1';
import { createHash } from 'react-native-quick-crypto';
import { logger } from '../../utils/logger';

/**
 * P2PK (Pay-to-Pubkey) Utilities - NUT-11 Implementation
 * Lock ecash tokens to a recipient's public key
 */

/**
 * Generate a new secp256k1 keypair for P2PK
 * @returns {Promise<Object>} { privateKey: string, publicKey: string }
 */
export const generateP2PKKeyPair = async () => {
  const privateKeyBytes = await crypto.getRandomBytesAsync(32);
  const privateKey = Buffer.from(privateKeyBytes).toString('hex');

  // Derive public key (33 bytes compressed)
  const publicKeyBytes = schnorr.getPublicKey(privateKey);
  const publicKey = Buffer.from(publicKeyBytes).toString('hex');

  return {
    privateKey,
    publicKey
  };
};

/**
 * Create a P2PK secret locked to a recipient's public key
 * @param {string} recipientPubkey - Recipient's public key (hex)
 * @param {Object} options - Optional P2PK parameters
 * @param {string} options.sigflag - 'SIG_INPUTS' or 'SIG_ALL' (default: SIG_INPUTS)
 * @param {Array<string>} options.pubkeys - Additional authorized public keys
 * @param {number} options.n_sigs - Required number of signatures
 * @param {number} options.locktime - Unix timestamp for locktime
 * @param {Array<string>} options.refund - Refund public keys after locktime
 * @param {number} options.n_sigs_refund - Required refund signatures
 * @returns {Promise<string>} P2PK secret (serialized JSON)
 */
export const createP2PKSecret = async (recipientPubkey, options = {}) => {
  // Generate random nonce
  const nonceBytes = await crypto.getRandomBytesAsync(32);
  const nonce = Buffer.from(nonceBytes).toString('hex');

  // Build tags array
  const tags = [];

  // Add sigflag (default: SIG_INPUTS)
  const sigflag = options.sigflag || 'SIG_INPUTS';
  tags.push(['sigflag', sigflag]);

  // Add additional pubkeys if provided
  if (options.pubkeys && options.pubkeys.length > 0) {
    tags.push(['pubkeys', ...options.pubkeys]);
  }

  // Add n_sigs if provided
  if (options.n_sigs) {
    tags.push(['n_sigs', options.n_sigs.toString()]);
  }

  // Add locktime if provided
  if (options.locktime) {
    tags.push(['locktime', options.locktime.toString()]);
  }

  // Add refund pubkeys if provided
  if (options.refund && options.refund.length > 0) {
    tags.push(['refund', ...options.refund]);
  }

  // Add n_sigs_refund if provided
  if (options.n_sigs_refund) {
    tags.push(['n_sigs_refund', options.n_sigs_refund.toString()]);
  }

  // Build P2PK secret structure
  const p2pkSecret = [
    'P2PK',
    {
      nonce,
      data: recipientPubkey,
      tags: tags.length > 0 ? tags : undefined
    }
  ];

  // Serialize to JSON
  const secretJson = JSON.stringify(p2pkSecret);

  logger.info('Created P2PK secret', {
    nonce: nonce.substring(0, 16) + '...',
    recipientPubkey: recipientPubkey.substring(0, 16) + '...',
    sigflag,
    tagCount: tags.length
  });

  return secretJson;
};

/**
 * Sign a P2PK secret to create a witness
 * @param {string} secret - The P2PK secret to sign (serialized JSON)
 * @param {string} privateKey - Private key to sign with (hex)
 * @returns {Promise<string>} P2PK witness (serialized JSON)
 */
export const signP2PKSecret = async (secret, privateKey) => {
  try {
    // Hash the secret (message to sign)
    const messageBytes = Buffer.from(secret, 'utf-8');
    const messageHash = createHash('sha256').update(messageBytes).digest();

    // Convert private key to Buffer if needed
    const privateKeyBuffer = typeof privateKey === 'string'
      ? Buffer.from(privateKey, 'hex')
      : privateKey;

    // Ensure both are proper Buffers and correct length
    if (messageHash.length !== 32) {
      throw new Error(`Invalid message hash length: ${messageHash.length}, expected 32`);
    }
    if (privateKeyBuffer.length !== 32) {
      throw new Error(`Invalid private key length: ${privateKeyBuffer.length}, expected 32`);
    }

    // Sign with Schnorr using @bitcoinerlab/secp256k1
    const signature = ecc.signSchnorr(messageHash, privateKeyBuffer);
    const signatureHex = Buffer.from(signature).toString('hex');

    // Create witness structure
    const witness = {
      signatures: [signatureHex]
    };

    return JSON.stringify(witness);
  } catch (error) {
    logger.error('Failed to sign P2PK secret', { error: error.message });
    throw new Error(`P2PK signing failed: ${error.message}`);
  }
};

/**
 * Check if a secret is a P2PK secret
 * @param {string} secret - Secret to check
 * @returns {boolean} True if P2PK secret
 */
export const isP2PKSecret = (secret) => {
  try {
    const parsed = JSON.parse(secret);
    return Array.isArray(parsed) && parsed[0] === 'P2PK';
  } catch {
    return false;
  }
};

/**
 * Extract recipient public key from P2PK secret
 * @param {string} secret - P2PK secret (serialized JSON)
 * @returns {string|null} Recipient's public key or null
 */
export const getP2PKRecipient = (secret) => {
  try {
    const parsed = JSON.parse(secret);
    if (!Array.isArray(parsed) || parsed[0] !== 'P2PK') {
      return null;
    }
    return parsed[1].data;
  } catch {
    return null;
  }
};

/**
 * Verify a P2PK witness signature (client-side verification)
 * @param {string} secret - The P2PK secret
 * @param {string} witness - The P2PK witness
 * @param {string} publicKey - Public key to verify against
 * @returns {Promise<boolean>} True if signature is valid
 */
export const verifyP2PKWitness = async (secret, witness, publicKey) => {
  try {
    const witnessData = JSON.parse(witness);
    if (!witnessData.signatures || witnessData.signatures.length === 0) {
      return false;
    }

    // Hash the secret
    const messageBytes = Buffer.from(secret, 'utf-8');
    const messageHash = await crypto.digest(
      crypto.CryptoDigestAlgorithm.SHA256,
      messageBytes
    );

    // Get signature
    const signatureHex = witnessData.signatures[0];
    const signatureBytes = Buffer.from(signatureHex, 'hex');

    // Get public key (remove 02/03 prefix if compressed, schnorr uses x-only)
    let pubkeyBytes;
    if (publicKey.length === 66) {
      // Compressed (02/03 prefix) - take x-coordinate only
      pubkeyBytes = Buffer.from(publicKey.slice(2), 'hex');
    } else if (publicKey.length === 64) {
      // Already x-only
      pubkeyBytes = Buffer.from(publicKey, 'hex');
    } else {
      return false;
    }

    // Verify
    const isValid = schnorr.verify(signatureBytes, messageHash, pubkeyBytes);

    return isValid;
  } catch (error) {
    logger.error('P2PK witness verification failed', { error: error.message });
    return false;
  }
};

/**
 * Check if a proof is P2PK locked
 * @param {Object} proof - Cashu proof object
 * @returns {boolean} True if proof has P2PK secret
 */
export const isP2PKLocked = (proof) => {
  return proof.secret && isP2PKSecret(proof.secret);
};

/**
 * Check if a token string contains P2PK locked proofs
 * @param {string} tokenString - Cashu token string (cashuA...)
 * @returns {boolean} True if token has any P2PK locked proofs
 */
export const hasP2PKProofs = (tokenString) => {
  try {
    // Import decodeToken inline to avoid circular dependency
    const { decodeToken } = require('./cashuCrypto');
    const decoded = decodeToken(tokenString);

    if (!decoded.proofs || !Array.isArray(decoded.proofs)) {
      return false;
    }

    // Check if any proof is P2PK locked
    return decoded.proofs.some(p => isP2PKSecret(p.secret));
  } catch (error) {
    logger.error('Failed to check for P2PK proofs', { error: error.message });
    return false;
  }
};

/**
 * Sign P2PK locked proofs with witness signatures
 * @param {Array<Object>} proofs - Array of Cashu proofs
 * @param {string} privateKey - Private key to sign with (hex, 32 bytes)
 * @returns {Promise<Array<Object>>} Proofs with witness signatures added
 */
export const signP2PKProofs = async (proofs, privateKey) => {
  logger.info('Signing P2PK proofs', { count: proofs.length });

  // Sign all proofs in parallel using Promise.all
  const signedProofs = await Promise.all(
    proofs.map(async (proof) => {
      if (isP2PKLocked(proof)) {
        // Sign the P2PK secret to create witness
        const witness = await signP2PKSecret(proof.secret, privateKey);

        // Add witness to proof
        return {
          ...proof,
          witness
        };
      } else {
        // Not P2PK locked, no witness needed
        return proof;
      }
    })
  );

  logger.info('Signed P2PK proofs complete', { count: signedProofs.length });
  return signedProofs;
};

// Cache keys for P2PK private key (cleared when account changes)
const CACHE_KEY_ADDRESS = 'p2pk_taproot_address_v2';
const CACHE_KEY_PRIVKEY = 'p2pk_private_key_v2';

/**
 * Clear P2PK cache (call when switching accounts)
 */
export const clearP2PKCache = async () => {
  const SecureStore = await import('expo-secure-store');
  try {
    await SecureStore.deleteItemAsync(CACHE_KEY_ADDRESS);
    await SecureStore.deleteItemAsync(CACHE_KEY_PRIVKEY);
    console.log('[clearP2PKCache] Cleared P2PK cache');
  } catch (error) {
    console.warn('[clearP2PKCache] Failed to clear cache:', error.message);
  }
};

/**
 * Find which account a P2PK token is locked to by scanning derivation paths
 * @param {string} recipientPubkey - The public key the token is locked to (hex)
 * @param {number} maxAccounts - Maximum number of accounts to check (default: 10)
 * @returns {Promise<{accountIndex: number, privateKey: string, address: string}|null>}
 */
export const findAccountForP2PKToken = async (recipientPubkey, maxAccounts = 10) => {
  const { withMnemonic } = await import('../secureStorageService.js');
  const { deriveAddressesFromMnemonic } = await import('../../utils/bitcoin.js');
  const { getPrivateKeyForAddress } = await import('../../utils/wallet.js');

  console.log('[findAccountForP2PKToken] Searching for account with pubkey:', recipientPubkey.substring(0, 16) + '...');

  // Try each account index
  for (let accountIndex = 0; accountIndex < maxAccounts; accountIndex++) {
    try {
      const addresses = await withMnemonic(async (mnemonic) => {
        return deriveAddressesFromMnemonic(mnemonic, accountIndex);
      });

      // Get the public key for this account
      const keyData = await getPrivateKeyForAddress(addresses.taprootAddress);

      // Compare x-only pubkeys (both should be 32 bytes / 64 hex chars)
      if (keyData.xOnlyPubkey === recipientPubkey) {
        console.log('[findAccountForP2PKToken] Found match at account index:', accountIndex);
        return {
          accountIndex,
          privateKey: keyData.privateKey,
          address: addresses.taprootAddress,
        };
      }
    } catch (error) {
      console.warn(`[findAccountForP2PKToken] Error checking account ${accountIndex}:`, error.message);
      continue;
    }
  }

  console.log('[findAccountForP2PKToken] No matching account found in', maxAccounts, 'accounts');
  return null;
};

/**
 * Get P2PK private key for current wallet (cached for performance)
 * Caches both the taproot address and derived private key
 * @returns {Promise<string>} Private key hex
 */
export const getP2PKPrivateKey = async () => {
  const SecureStore = await import('expo-secure-store');
  const { withMnemonic, getCurrentAccount } = await import('../secureStorageService.js');
  const { deriveAddressesFromMnemonic } = await import('../../utils/bitcoin.js');
  const { getPrivateKeyForAddress } = await import('../../utils/wallet.js');

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
      console.log('[getP2PKPrivateKey] Using cached key (verified for current account)');
      return cachedPrivKey;
    } else if (cachedAddress && cachedAddress !== currentAddress) {
      console.log('[getP2PKPrivateKey] Cache invalid - address mismatch (account changed)');
      // Clear stale cache
      await SecureStore.deleteItemAsync(CACHE_KEY_ADDRESS);
      await SecureStore.deleteItemAsync(CACHE_KEY_PRIVKEY);
    }
  } catch (error) {
    console.warn('[getP2PKPrivateKey] Cache read failed:', error.message);
  }

  console.log('[getP2PKPrivateKey] Deriving private key for current account...');

  // Derive private key for current account
  const keyData = await getPrivateKeyForAddress(currentAddress);

  // Cache both for next time
  try {
    await SecureStore.setItemAsync(CACHE_KEY_ADDRESS, addresses.taprootAddress);
    await SecureStore.setItemAsync(CACHE_KEY_PRIVKEY, keyData.privateKey);
    console.log('[getP2PKPrivateKey] Cached address and key');
  } catch (error) {
    console.warn('[getP2PKPrivateKey] Cache write failed:', error.message);
  }

  return keyData.privateKey;
};

export default {
  generateP2PKKeyPair,
  createP2PKSecret,
  signP2PKSecret,
  isP2PKSecret,
  getP2PKRecipient,
  verifyP2PKWitness,
  isP2PKLocked,
  hasP2PKProofs,
  signP2PKProofs,
  getP2PKPrivateKey,
  findAccountForP2PKToken,
  clearP2PKCache
};
