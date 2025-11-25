/**
 * Crypto helper functions for wallet operations
 */

import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import ECPairFactory from 'ecpair';
import * as ecc from '@bitcoinerlab/secp256k1';
import { MUTINYNET_NETWORK } from '../bitcoin';

// Initialize BIP32
export const bip32 = BIP32Factory(ecc);

// Export ecc for external use
export { ecc };

// Lazy initialization of ECPair (needs Buffer global)
let ECPair = null;
export function getECPair() {
  if (!ECPair) {
    ECPair = ECPairFactory(ecc);
  }
  return ECPair;
}

/**
 * Write a variable-length integer (varint)
 */
export function writeVarInt(buffer, value, offset) {
  if (value < 0xfd) {
    buffer.writeUInt8(value, offset);
    return offset + 1;
  } else if (value <= 0xffff) {
    buffer.writeUInt8(0xfd, offset);
    buffer.writeUInt16LE(value, offset + 1);
    return offset + 3;
  } else if (value <= 0xffffffff) {
    buffer.writeUInt8(0xfe, offset);
    buffer.writeUInt32LE(value, offset + 1);
    return offset + 5;
  } else {
    // istanbul ignore next - Untestable: Bitcoin scripts cannot exceed 4GB
    buffer.writeUInt8(0xff, offset);
    // istanbul ignore next
    buffer.writeUInt16LE(value & 0xffffffff, offset + 1);
    // istanbul ignore next
    buffer.writeUInt32LE(Math.floor(value / 0x100000000), offset + 5);
    // istanbul ignore next
    return offset + 9;
  }
}

/**
 * Get the size of a varint encoding
 */
export function varIntSize(value) {
  if (value < 0xfd) return 1;
  if (value <= 0xffff) return 3;
  if (value <= 0xffffffff) return 5;
  // istanbul ignore next - Untestable: Bitcoin scripts cannot exceed 4GB
  return 9;
}

/**
 * Derive a key from mnemonic
 */
export function deriveKeyFromMnemonic(mnemonic, derivationPath) {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);
  return root.derivePath(derivationPath);
}

/**
 * Get derivation path for address type
 */
export function getDerivationPath(address, accountIndex) {
  if (address.startsWith('tb1q')) {
    // P2WPKH (SegWit) - BIP84
    return `m/84'/1'/0'/0/${accountIndex}`;
  } else if (address.startsWith('tb1p')) {
    // P2TR (Taproot) - BIP86
    return `m/86'/1'/0'/0/${accountIndex}`;
  } else {
    throw new Error(`Unsupported address type: ${address}`);
  }
}
