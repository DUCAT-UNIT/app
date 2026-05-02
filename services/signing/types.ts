/**
 * Unified PSBT Signing Types
 *
 * Shared type definitions for the consolidated signing service.
 * These types support both wallet-level signing (BTC/UNIT sends)
 * and vault-specific signing operations.
 */

import * as bitcoin from 'bitcoinjs-lib';

/**
 * Internal PSBT cache type for low-level signing operations.
 * bitcoinjs-lib exposes __CACHE for advanced use cases like Taproot signing.
 */
export interface PsbtCache {
  __TX: bitcoin.Transaction & {
    hashForWitnessV1(
      inputIndex: number,
      scripts: Buffer[],
      values: bigint[],
      sighashType: number,
      leafHash?: Buffer
    ): Buffer;
  };
}

/**
 * Signature data for binary patching
 */
export interface SignatureData {
  inputIndex: number;
  type: 'segwit' | 'taproot-key' | 'taproot-script';
  pubkey?: Buffer;
  signature: Buffer;
  leafHash?: Buffer;
}

/**
 * PSBT field data for binary patching
 */
export interface PsbtFieldData {
  inputIndex: number;
  fields: Array<{ keyType: number; key: Buffer; value: Buffer }>;
}

/**
 * Result of witness data extraction
 */
export interface WitnessData {
  scripts: Buffer[];
  values: bigint[];
}

/**
 * Address type detection result
 */
export interface AddressTypeInfo {
  isSegwit: boolean;
  isTaproot: boolean;
  derivationPath: string;
}
