/**
 * VaultWallet Types
 */

import type { WalletConfig } from '@ducat-unit/client-sdk';
import * as bitcoin from 'bitcoinjs-lib';
import { API, VAULT_CONFIG } from '../../utils/constants';

// Mutinynet master contract ID
export const MASTER_CONTRACT_ID = '02837661131516ad503dbe0bcf73964244d5f02bc577678ffd3fcbb54f493f36i0';

// Wallet configuration for mutinynet
export const WALLET_CFG: WalletConfig = {
  indexer: {
    esp: API.ESPLORA_URL,
    ord: API.ORD_URL,
  },
  network: 'mutiny',
  postage: {
    unit: VAULT_CONFIG.UNIT_POSTAGE,
    vault: VAULT_CONFIG.TOKEN_POSTAGE,
  },
};

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

export interface MobileWalletInfo {
  segwitAddress: string;
  segwitPubkey: string;
  taprootAddress: string;
  taprootPubkey: string;
}

export interface SignatureData {
  inputIndex: number;
  type: 'segwit' | 'taproot-key' | 'taproot-script';
  pubkey?: Buffer;
  signature: Buffer;
  leafHash?: Buffer;
}

export interface PsbtFieldData {
  inputIndex: number;
  fields: Array<{ keyType: number; key: Buffer; value: Buffer }>;
}
