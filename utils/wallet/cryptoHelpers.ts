/**
 * Crypto helper functions for wallet operations
 */

import { Buffer } from 'buffer';
import * as bip39 from 'bip39';
import { BIP32Factory, BIP32Interface } from 'bip32';
import ECPairFactory, { ECPairAPI } from 'ecpair';
import * as ecc from '@bitcoinerlab/secp256k1';
import {
  DEFAULT_WALLET_DERIVATION_MODE,
  getDerivationPathForType,
  type WalletDerivationMode,
} from '../../constants/bitcoin';
import { MUTINYNET_NETWORK } from '../bitcoin';

// Initialize BIP32
export const bip32 = BIP32Factory(ecc);

// Export ecc for external use
export { ecc };

// Lazy initialization of ECPair (needs Buffer global)
let ECPair: ECPairAPI | null = null;
export function getECPair(): ECPairAPI {
  if (!ECPair) {
    ECPair = ECPairFactory(ecc);
  }
  return ECPair;
}

/**
 * Write a variable-length integer (varint)
 */
export function writeVarInt(buffer: Buffer, value: number, offset: number): number {
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
export function varIntSize(value: number): number {
  if (value < 0xfd) return 1;
  if (value <= 0xffff) return 3;
  if (value <= 0xffffffff) return 5;
  // istanbul ignore next - Untestable: Bitcoin scripts cannot exceed 4GB
  return 9;
}

/**
 * Derive a key from mnemonic
 */
export function deriveKeyFromMnemonic(mnemonic: string, derivationPath: string): BIP32Interface {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);
  return root.derivePath(derivationPath);
}

export function getDerivationPath(
  address: string,
  accountIndex: number,
  derivationMode: WalletDerivationMode = DEFAULT_WALLET_DERIVATION_MODE
): string {
  const lowerAddress = address.toLowerCase();
  const segwitPrefix = `${MUTINYNET_NETWORK.bech32}1q`;
  const taprootPrefix = `${MUTINYNET_NETWORK.bech32}1p`;

  if (lowerAddress.startsWith(segwitPrefix)) {
    return getDerivationPathForType('segwit', accountIndex, derivationMode);
  } else if (lowerAddress.startsWith(taprootPrefix)) {
    return getDerivationPathForType('taproot', accountIndex, derivationMode);
  } else {
    throw new Error(`Unsupported address type: ${address}`);
  }
}
