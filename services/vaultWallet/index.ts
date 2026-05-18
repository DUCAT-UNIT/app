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
const PROTOCOL_CONTRACT_FETCH_TIMEOUT_MS = 12_000;
const BUNDLED_PROTOCOL_CONTRACT: ProtocolProfile = {
  ctx: {
    groups: {
      guard: ['tb1p68qym8p8w5uanqwmtd7mjxghg5hft420h7sxrnmvvl72ryn2lxjs4ws7jh', 2052633701820968],
      oracle: ['tb1p68qym8p8w5uanqwmtd7mjxghg5hft420h7sxrnmvvl72ryn2lxjs4ws7jh', 2052633700709092],
    },
    runes: {
      unit: [
        'tb1p68qym8p8w5uanqwmtd7mjxghg5hft420h7sxrnmvvl72ryn2lxjs4ws7jh',
        '8d7c540d9378cf39aa56b719c3b9826807e243ab68313875a0be073a64b70b54i0',
      ],
    },
    terms: {
      repo: ['tb1p68qym8p8w5uanqwmtd7mjxghg5hft420h7sxrnmvvl72ryn2lxjs4ws7jh', 2052633700882037],
      vault: ['tb1p68qym8p8w5uanqwmtd7mjxghg5hft420h7sxrnmvvl72ryn2lxjs4ws7jh', 2052633702136779],
    },
    ver: 2,
  },
  groups: {
    guard: {
      adr: 'tb1pmf8vf4xpylshj5fqk5zt6am7g2tp5sr29vxe6m5xpn37dcn9n8jq28j93p',
      pub: 'da4ec4d4c127e1795120b504bd777e42961a406a2b0d9d6e860ce3e6e26599e4',
      thd: 3,
    },
    oracle: {
      adr: 'tb1pypquwtpr80jq93a8f2tfa9w5q3ar756l29etk6ev5f9e8hzsqa7sgr27rj',
    },
  },
  master_id: '02837661131516ad503dbe0bcf73964244d5f02bc577678ffd3fcbb54f493f36i0',
  points: {
    repo: {
      adr: 'tb1p8fcm0zrpytpkr7z4k79xlu997uqpfkdkxcph6kgpsr3m3cea7skspemkld',
      ptr: [
        [10101, 2052633700761941],
        [10102, 2052633700771951],
        [10103, 2052633700781961],
        [10104, 2052633700791971],
        [10105, 2052633700801981],
        [10106, 2052633700811991],
      ],
    },
    vault: {
      adr: 'tb1p8fcm0zrpytpkr7z4k79xlu997uqpfkdkxcph6kgpsr3m3cea7skspemkld',
      ptr: [
        [10107, 1991914966595598],
        [10108, 1991914966605604],
        [10109, 1991914966615610],
        [10110, 1991914966625616],
      ],
    },
  },
  runes: {
    unit: {
      address: 'tb1p68qym8p8w5uanqwmtd7mjxghg5hft420h7sxrnmvvl72ryn2lxjs4ws7jh',
      divisor: 2,
      issued: 10000000000000,
      label: 'DUCAT•UNIT•RUNE',
      mint_id: '8d7c540d9378cf39aa56b719c3b9826807e243ab68313875a0be073a64b70b54i0',
      rune_id: '1527352:1',
      symbol: '$',
      utxo: {
        txid: '4354e117c9243dc7cbc22ba537a8347a02311b05efef97b4c020eade03d6db13',
        vout: 0,
        value: 10005,
        script: '5120d1c04d9c277539d981db5b7db91917452e95d54fbfa061cf6c67fca1926af9a5',
      },
    },
  },
  terms: new Map([
    ['repo_liquidation_thold', [1.35]],
    ['repo_reserve_pubkey', ['604cb84df7bb174100d3b9385ac9b24ecf6e8c444833248a6f18ecb157440ae5']],
    ['repo_reserve_sats_min', [5000]],
    ['repo_liquid_tax_rate', [0.15]],
    ['repo_subsidy_inc_rate', [0.006]],
    ['repo_subsidy_inc_thold', [1.25]],
    ['vault_collateral_min', [1.6]],
    ['vault_internal_key', ['50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0']],
    ['vault_sats_balance_min', [10000]],
    ['vault_unit_balance_min', [100]],
  ]),
};

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
function cacheProtocolContract(contract: ProtocolProfile): ProtocolProfile {
  cachedProtocolContract = {
    contract,
    fetchedAt: Date.now(),
  };
  return contract;
}

function getBundledProtocolContract(): ProtocolProfile | null {
  return MASTER_CONTRACT_ID === BUNDLED_PROTOCOL_CONTRACT.master_id
    ? BUNDLED_PROTOCOL_CONTRACT
    : null;
}

function getCachedProtocolContract(): ProtocolProfile | null {
  if (cachedProtocolContract) {
    return cachedProtocolContract.contract;
  }

  const bundledContract = getBundledProtocolContract();
  if (bundledContract) {
    logger.info('[VaultWalletService] Using bundled protocol contract', {
      masterContractId: MASTER_CONTRACT_ID,
    });
    return cacheProtocolContract(bundledContract);
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
    const res = await withVaultBuildTimeout(
      OracleAPI.proto.fetch_master_ctx(API.ORD_URL, MASTER_CONTRACT_ID),
      'Timed out fetching vault protocol contract. Please try again.',
      PROTOCOL_CONTRACT_FETCH_TIMEOUT_MS
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch protocol: ${res.error}`);
    }

    const contract = cacheProtocolContract(res.data);
    logger.info('[VaultWalletService] Protocol contract fetched', {
      durationMs: Date.now() - startedAt,
      masterContractId: MASTER_CONTRACT_ID,
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
  if (getBundledProtocolContract()) {
    void getCachedProtocolContract();
    return;
  }

  void fetchProtocolContractFromNetwork().catch((error: unknown) => {
    logger.debug('[VaultWalletService] Protocol contract background refresh failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

export async function fetchProtocolContract(): Promise<ProtocolProfile> {
  const now = Date.now();
  if (
    cachedProtocolContract &&
    now - cachedProtocolContract.fetchedAt < PROTOCOL_CONTRACT_CACHE_TTL_MS
  ) {
    return cachedProtocolContract.contract;
  }

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
