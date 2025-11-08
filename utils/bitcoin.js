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
