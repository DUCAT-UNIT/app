/**
 * Unified PSBT Signing Types
 *
 * Shared type definitions for the consolidated signing service.
 * These types support both wallet-level signing (BTC/UNIT sends)
 * and vault-specific signing operations.
 */

import * as bitcoin from 'bitcoinjs-lib';
import type { VaultWallet } from '@ducat-unit/client-sdk';

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
 * PSBT with internal cache exposed for Taproot signing
 */
export type PsbtWithCache = bitcoin.Psbt & { __CACHE: PsbtCache };

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
 * Mobile wallet info for address derivation
 */
export interface MobileWalletInfo {
  segwitAddress: string;
  segwitPubkey: string;
  taprootAddress: string;
  taprootPubkey: string;
}

/**
 * Signing context for determining signing behavior
 */
export type SigningContext = 'wallet' | 'vault';

/**
 * Options for PSBT signing operations
 */
export interface PsbtSigningOptions {
  /**
   * Whether to finalize inputs after signing (default: false for vault, true for wallet)
   */
  finalizeInputs?: boolean;

  /**
   * Original PSBT base64 to preserve (used for OP_RETURN preservation in vault)
   */
  originalPsbtBase64?: string;

  /**
   * Account index override (default: read from SecureStore)
   */
  accountIndex?: number;
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

/**
 * Vault signing context with SDK client
 */
export interface VaultSigningContext {
  client: VaultWallet;
  manifest: Record<string, number[]>;
}
