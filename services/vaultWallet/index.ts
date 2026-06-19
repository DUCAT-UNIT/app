/**
 * VaultWallet Service
 * Creates a VaultWallet instance using the mobile app's wallet
 */

import {
  VaultWallet,
  type WalletAccountRecord,
  type ProtocolProfile,
} from '@ducat-unit/client-sdk';
import { API } from '../../utils/constants';
import { getJSON } from '../../utils/apiClient';
import { logger } from '../../utils/logger';
import { withVaultBuildTimeout } from '../vault/operationTimeout';
import { MASTER_CONTRACT_ID, WALLET_CFG, MobileWalletInfo } from './types';
import { createMobileWalletAPI } from './walletApi';

const PROTOCOL_CONTRACT_CACHE_TTL_MS = 10 * 60 * 1000;
const PROTOCOL_CONTRACT_FETCH_TIMEOUT_MS = 12_000;

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
 * Fetches the latest protocol profile from the Dev validator.
 */
function cacheProtocolContract(contract: ProtocolProfile): ProtocolProfile {
  cachedProtocolContract = {
    contract,
    fetchedAt: Date.now(),
  };
  return contract;
}

function getCachedProtocolContract(): ProtocolProfile | null {
  if (
    cachedProtocolContract &&
    Date.now() - cachedProtocolContract.fetchedAt < PROTOCOL_CONTRACT_CACHE_TTL_MS
  ) {
    return cachedProtocolContract.contract;
  }

  return null;
}

async function fetchProtocolContractFromNetwork(): Promise<ProtocolProfile> {
  if (protocolContractInFlight) {
    return protocolContractInFlight;
  }

  const startedAt = Date.now();
  logger.info('[VaultWalletService] Fetching protocol contract', {
    masterContractId: MASTER_CONTRACT_ID,
  });

  protocolContractInFlight = (async () => {
    const contract = await withVaultBuildTimeout(
      getJSON<ProtocolProfile>(`${API.VALIDATOR}/api/proto/latest`, {
        timeout: PROTOCOL_CONTRACT_FETCH_TIMEOUT_MS,
        retryOptions: { maxRetries: 1 },
        dedupeKey: 'validator-proto-latest',
        cacheKey: 'validator-proto-latest',
        cacheTtlMs: PROTOCOL_CONTRACT_CACHE_TTL_MS,
        circuitKey: 'validator-proto-latest',
      }),
      'Timed out fetching vault protocol contract. Please try again.',
      PROTOCOL_CONTRACT_FETCH_TIMEOUT_MS
    );

    if (MASTER_CONTRACT_ID && contract.contract_id !== MASTER_CONTRACT_ID) {
      logger.warn('[VaultWalletService] Validator protocol contract differs from configured id', {
        configuredContractId: MASTER_CONTRACT_ID,
        validatorContractId: contract.contract_id,
      });
    }

    cacheProtocolContract(contract);
    logger.info('[VaultWalletService] Protocol contract fetched', {
      durationMs: Date.now() - startedAt,
      contractId: contract.contract_id,
    });
    return contract;
  })();

  try {
    return await protocolContractInFlight;
  } finally {
    protocolContractInFlight = null;
  }
}

function refreshProtocolContractInBackground(): void {
  void fetchProtocolContractFromNetwork().catch((error: unknown) => {
    logger.debug('[VaultWalletService] Protocol contract background refresh failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

export async function fetchProtocolContract(): Promise<ProtocolProfile> {
  const cachedContract = getCachedProtocolContract();
  if (cachedContract) {
    return cachedContract;
  }

  return fetchProtocolContractFromNetwork();
}

export function prefetchProtocolContract(): void {
  refreshProtocolContractInBackground();
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
