/**
 * Bitcoin utilities - network configuration and address derivation
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from '@bitcoinerlab/secp256k1';

// Initialize BIP32
const bip32 = BIP32Factory(ecc);

// Mutinynet signet network configuration
export const MUTINYNET_NETWORK = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'tb',
  bip32: {
    public: 0x043587cf,
    private: 0x04358394,
  },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef,
};

/**
 * Derive SegWit and Taproot addresses from a BIP39 mnemonic
 * @param {string} mnemonic - BIP39 mnemonic phrase
 * @param {number} accountIndex - Account index for derivation (default: 0)
 * @returns {Object} Object containing segwitAddress, taprootAddress, segwitPubkey, taprootPubkey
 */
export const deriveAddressesFromMnemonic = (mnemonic, accountIndex = 0) => {
  // Convert mnemonic to seed
  const seed = bip39.mnemonicToSeedSync(mnemonic);

  // Create HD wallet root
  const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

  // BIP84 - Native SegWit
  const segwitPath = `m/84'/1'/0'/0/${accountIndex}`;
  const segwitChild = root.derivePath(segwitPath);
  const segwitPayment = bitcoin.payments.p2wpkh({
    pubkey: segwitChild.publicKey,
    network: MUTINYNET_NETWORK,
  });

  // BIP86 - Taproot
  const taprootPath = `m/86'/1'/0'/0/${accountIndex}`;
  const taprootChild = root.derivePath(taprootPath);
  const xOnlyPubkey = taprootChild.publicKey.slice(1, 33);
  const taprootPayment = bitcoin.payments.p2tr({
    internalPubkey: xOnlyPubkey,
    network: MUTINYNET_NETWORK,
  });

  return {
    segwitAddress: segwitPayment.address,
    taprootAddress: taprootPayment.address,
    segwitPubkey: Buffer.from(segwitChild.publicKey).toString('hex'),
    taprootPubkey: Buffer.from(xOnlyPubkey).toString('hex'), // Use x-only pubkey (32 bytes) for Taproot
  };
};

/**
 * Validate a Bitcoin address for the current network
 * @param {string} address - Bitcoin address to validate
 * @returns {{valid: boolean, type?: string, error?: string}} Validation result
 */
export const validateBitcoinAddress = (address) => {
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Address is required' };
  }

  const trimmedAddress = address.trim();

  if (trimmedAddress.length === 0) {
    return { valid: false, error: 'Address cannot be empty' };
  }

  try {
    // Try to decode the address using bitcoinjs-lib
    const _decoded = bitcoin.address.toOutputScript(trimmedAddress, MUTINYNET_NETWORK);

    // Determine address type based on prefix
    let addressType = 'unknown';
    if (trimmedAddress.startsWith('tb1p')) {
      addressType = 'taproot'; // Bech32m (P2TR)
    } else if (trimmedAddress.startsWith('tb1q')) {
      addressType = 'segwit'; // Bech32 (P2WPKH)
    } else if (
      trimmedAddress.startsWith('2') ||
      trimmedAddress.startsWith('m') ||
      trimmedAddress.startsWith('n')
    ) {
      addressType = 'legacy'; // P2SH or P2PKH
    }

    return {
      valid: true,
      type: addressType,
    };
  } catch (error) {
    // Check if it might be a mainnet address
    if (address.startsWith('bc1') || address.startsWith('1') || address.startsWith('3')) {
      return {
        valid: false,
        error:
          'Mainnet address detected. Please use a testnet address (starting with tb1, 2, m, or n)',
      };
    }

    return {
      valid: false,
      error: 'Invalid Bitcoin address format',
    };
  }
};

/**
 * Validate and normalize a Bitcoin address
 * @param {string} address - Bitcoin address to validate and normalize
 * @returns {string} Normalized address (trimmed)
 * @throws {Error} If address is invalid
 */
export const validateAndNormalizeAddress = (address) => {
  const validation = validateBitcoinAddress(address);

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  return address.trim();
};
