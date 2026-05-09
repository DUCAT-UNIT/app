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
import { withVaultBuildTimeout } from '../vault/operationTimeout';
import { MASTER_CONTRACT_ID, WALLET_CFG, MobileWalletInfo } from './types';
import { createMobileWalletAPI } from './walletApi';

const PROTOCOL_CONTRACT_CACHE_TTL_MS = 10 * 60 * 1000;
let cachedProtocolContract: { contract: ProtocolProfile; fetchedAt: number } | null = null;
let protocolContractInFlight: Promise<ProtocolProfile> | null = null;

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

// Re-export signing functions from unified signing service
export {
  signPsbtWithSdkObject,
  patchPreProcessFields,
  patchPostProcessFields,
  psbtPreProcess,
  psbtPostProcess,
} from '../signing';

// Re-export wallet API
export { createMobileWalletAPI } from './walletApi';

/**
 * Fetches the protocol contract from the ord server
 */
export async function fetchProtocolContract(): Promise<ProtocolProfile> {
  const now = Date.now();
  if (
    cachedProtocolContract &&
    now - cachedProtocolContract.fetchedAt < PROTOCOL_CONTRACT_CACHE_TTL_MS
  ) {
    return cachedProtocolContract.contract;
  }

  if (protocolContractInFlight) {
    return protocolContractInFlight;
  }

  logger.debug('[VaultWalletService] Fetching protocol contract...');

  protocolContractInFlight = (async () => {
    const res = await withVaultBuildTimeout(
      OracleAPI.proto.fetch_master_ctx(API.ORD_URL, MASTER_CONTRACT_ID),
      'Timed out fetching vault protocol contract. Please try again.'
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch protocol: ${res.error}`);
    }

    cachedProtocolContract = {
      contract: res.data,
      fetchedAt: Date.now(),
    };
    logger.debug('[VaultWalletService] Protocol contract fetched');
    return res.data;
  })();

  try {
    return await protocolContractInFlight;
  } finally {
    protocolContractInFlight = null;
  }
}

export function prefetchProtocolContract(): void {
  void fetchProtocolContract().catch((error: unknown) => {
    logger.debug('[VaultWalletService] Protocol contract prefetch failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  });
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
