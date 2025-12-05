/**
 * VaultWallet Service
 * Creates a VaultWallet instance using the mobile app's wallet
 */

import {
  VaultWallet,
  OracleAPI,
  type WalletAccountRecord,
  type ProtocolProfile,
} from '@ducat-unit/client-sdk';
import { API } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { MASTER_CONTRACT_ID, WALLET_CFG, MobileWalletInfo } from './types';
import { createMobileWalletAPI } from './walletApi';

// Re-export types
export type { MobileWalletInfo, SignatureData, PsbtFieldData } from './types';
export { MASTER_CONTRACT_ID, WALLET_CFG } from './types';

// Re-export utilities
export {
  readVarInt,
  countPsbtInputs,
  createPsbtKv,
  encodeWitnessStack,
  extractOpReturnFromPsbt,
  patchPsbtSignatures,
  patchPsbtInputFields,
} from './psbtBinaryUtils';

// Re-export signing functions
export {
  signPsbtWithSdkObject,
  patchPreProcessFields,
  patchPostProcessFields,
  psbtPreProcess,
  psbtPostProcess,
} from './psbtSigning';

// Re-export wallet API
export { createMobileWalletAPI } from './walletApi';

/**
 * Fetches the protocol contract from the ord server
 */
export async function fetchProtocolContract(): Promise<ProtocolProfile> {
  logger.debug('[VaultWalletService] Fetching protocol contract...');

  const res = await OracleAPI.proto.fetch_master_ctx(API.ORD_URL, MASTER_CONTRACT_ID);

  if (!res.ok) {
    throw new Error(`Failed to fetch protocol: ${res.error}`);
  }

  logger.debug('[VaultWalletService] Protocol contract fetched');
  return res.data;
}

/**
 * Creates a VaultWallet instance for the mobile app
 */
export async function createVaultWallet(walletInfo: MobileWalletInfo): Promise<VaultWallet> {
  logger.debug('[VaultWalletService] Creating VaultWallet...');

  // Fetch the protocol contract
  const contract = await fetchProtocolContract();

  // Create account record from mobile wallet
  const accounts: WalletAccountRecord = {
    sats: {
      address: walletInfo.segwitAddress,
      pubkey: walletInfo.segwitPubkey,
    },
    runes: {
      address: walletInfo.taprootAddress,
      pubkey: walletInfo.taprootPubkey,
    },
    vault: {
      address: walletInfo.taprootAddress,
      pubkey: walletInfo.taprootPubkey,
    },
  };

  // Create the wallet connect API
  const walletAPI = createMobileWalletAPI(walletInfo.segwitAddress);

  // Create the VaultWallet
  const vaultWallet = new VaultWallet(accounts, contract, walletAPI, WALLET_CFG);

  logger.debug('[VaultWalletService] VaultWallet created');
  return vaultWallet;
}
