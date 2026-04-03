import * as bitcoin from 'bitcoinjs-lib';
import type { Network } from 'bitcoinjs-lib';
import type { ChainNetwork } from '@ducat-unit/client-sdk';

export type AppNetworkId = 'mutinynet' | 'mainnet';

export interface RuneIdentifier {
  block: bigint;
  tx: bigint;
}

export interface AppNetworkConfig {
  id: AppNetworkId;
  displayName: string;
  editionLabel: string;
  isTestNetwork: boolean;
  bitcoinjs: Network;
  coinType: number;
  vaultSdkNetwork: ChainNetwork;
  addressPrefixes: {
    segwit: string;
    taproot: string;
    legacy: string[];
    all: string[];
    oppositeDisplayName: string;
    oppositeAll: string[];
  };
  api: {
    explorerBaseUrl: string;
    esploraApiUrl: string;
    ordUrl: string;
    guardianWs: string;
    quoteServer: string;
    priceServer: string;
    vaultUrl: string;
    phoneUrl: string;
    coingeckoUrl: string;
    feeRecommendationsUrl: string;
    faucetUrl: string | null;
    faucetNetwork: string | null;
  };
  protocol: {
    masterContractId: string;
    turboMintAddress: string | null;
  };
  runes: {
    unitId: RuneIdentifier;
    unitLabel: string;
  };
}

const MUTINYNET_BITCOIN_NETWORK: Network = {
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

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getBigIntEnv(name: string): bigint | undefined {
  const value = getEnv(name);
  if (!value) {
    return undefined;
  }

  try {
    return BigInt(value);
  } catch {
    throw new Error(`Invalid bigint value for ${name}: ${value}`);
  }
}

function requireEnv(name: string, networkId: AppNetworkId): string {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required ${name} for ${networkId} configuration`);
  }

  return value;
}

function requireBigIntEnv(name: string, networkId: AppNetworkId): bigint {
  const value = getBigIntEnv(name);
  if (value === undefined) {
    throw new Error(`Missing required ${name} for ${networkId} configuration`);
  }

  return value;
}

function resolveAppNetworkId(): AppNetworkId {
  const configured = getEnv('EXPO_PUBLIC_APP_NETWORK') ?? 'mutinynet';
  if (configured === 'mutinynet' || configured === 'mainnet') {
    return configured;
  }

  throw new Error(
    `Unsupported EXPO_PUBLIC_APP_NETWORK value "${configured}". Expected "mutinynet" or "mainnet".`
  );
}

function buildAddressPrefixes(
  bech32: string,
  legacy: string[],
  oppositeDisplayName: string,
  oppositeBech32: string,
  oppositeLegacy: string[]
): AppNetworkConfig['addressPrefixes'] {
  return {
    segwit: `${bech32}1q`,
    taproot: `${bech32}1p`,
    legacy,
    all: [`${bech32}1`, ...legacy],
    oppositeDisplayName,
    oppositeAll: [`${oppositeBech32}1`, ...oppositeLegacy],
  };
}

function resolveMutinynetConfig(): AppNetworkConfig {
  const unitLabel = getEnv('EXPO_PUBLIC_UNIT_RUNE_LABEL') ?? 'DUCAT•UNIT•RUNE';

  return {
    id: 'mutinynet',
    displayName: 'Mutinynet',
    editionLabel: 'Mutinynet Edition',
    isTestNetwork: true,
    bitcoinjs: MUTINYNET_BITCOIN_NETWORK,
    coinType: 1,
    vaultSdkNetwork: 'mutiny',
    addressPrefixes: buildAddressPrefixes('tb', ['2', 'm', 'n'], 'mainnet', 'bc', ['3', '1']),
    api: {
      explorerBaseUrl: getEnv('EXPO_PUBLIC_EXPLORER_URL') ?? 'https://mutinynet.com',
      esploraApiUrl: getEnv('EXPO_PUBLIC_ESPLORA_API_URL') ?? 'https://mutinynet.com/api',
      ordUrl: getEnv('EXPO_PUBLIC_ORD_API_URL') ?? 'https://ord-mutinynet.ducatprotocol.com',
      guardianWs: getEnv('EXPO_PUBLIC_GUARDIAN_WS_URL') ?? 'wss://guardian-mutinynet-1.ducatprotocol.com',
      quoteServer: getEnv('EXPO_PUBLIC_QUOTE_SERVER_URL') ?? 'https://quote.ducatprotocol.com',
      priceServer: getEnv('EXPO_PUBLIC_PRICE_SERVER_URL') ?? 'https://price.ducatprotocol.com',
      vaultUrl: getEnv('EXPO_PUBLIC_VAULT_API_URL') ?? 'https://validator.ducatprotocol.com/api',
      phoneUrl: getEnv('EXPO_PUBLIC_PHONE_URL') ?? 'https://phone.ducatprotocol.com',
      coingeckoUrl: 'https://api.coingecko.com/api/v3',
      feeRecommendationsUrl:
        getEnv('EXPO_PUBLIC_FEE_RECOMMENDATIONS_URL') ??
        'https://mempool.space/testnet/api/v1/fees/recommended',
      faucetUrl: getEnv('EXPO_PUBLIC_FAUCET_URL') ?? 'https://faucet.ducatprotocol.com/btc/faucet',
      faucetNetwork: 'mutinynet',
    },
    protocol: {
      masterContractId:
        getEnv('EXPO_PUBLIC_MASTER_CONTRACT_ID') ??
        '02837661131516ad503dbe0bcf73964244d5f02bc577678ffd3fcbb54f493f36i0',
      turboMintAddress:
        getEnv('EXPO_PUBLIC_TURBO_MINT_ADDRESS') ??
        'tb1p7p74tg67aaw94vz2kewzeyuq80x0a65wpgegnat98f5hkcnpfjsqntv2em',
    },
    runes: {
      unitId: {
        block: getBigIntEnv('EXPO_PUBLIC_UNIT_RUNE_BLOCK') ?? 1527352n,
        tx: getBigIntEnv('EXPO_PUBLIC_UNIT_RUNE_TX') ?? 1n,
      },
      unitLabel,
    },
  };
}

function resolveMainnetConfig(): AppNetworkConfig {
  const networkId: AppNetworkId = 'mainnet';

  return {
    id: networkId,
    displayName: 'Mainnet',
    editionLabel: 'Mainnet Edition',
    isTestNetwork: false,
    bitcoinjs: bitcoin.networks.bitcoin,
    coinType: 0,
    vaultSdkNetwork: 'main',
    addressPrefixes: buildAddressPrefixes('bc', ['3', '1'], 'testnet', 'tb', ['2', 'm', 'n']),
    api: {
      explorerBaseUrl: getEnv('EXPO_PUBLIC_EXPLORER_URL') ?? 'https://mempool.space',
      esploraApiUrl: getEnv('EXPO_PUBLIC_ESPLORA_API_URL') ?? 'https://mempool.space/api',
      ordUrl: requireEnv('EXPO_PUBLIC_ORD_API_URL', networkId),
      guardianWs: requireEnv('EXPO_PUBLIC_GUARDIAN_WS_URL', networkId),
      quoteServer: getEnv('EXPO_PUBLIC_QUOTE_SERVER_URL') ?? 'https://quote.ducatprotocol.com',
      priceServer: getEnv('EXPO_PUBLIC_PRICE_SERVER_URL') ?? 'https://price.ducatprotocol.com',
      vaultUrl: getEnv('EXPO_PUBLIC_VAULT_API_URL') ?? 'https://validator.ducatprotocol.com/api',
      phoneUrl: getEnv('EXPO_PUBLIC_PHONE_URL') ?? 'https://phone.ducatprotocol.com',
      coingeckoUrl: 'https://api.coingecko.com/api/v3',
      feeRecommendationsUrl:
        getEnv('EXPO_PUBLIC_FEE_RECOMMENDATIONS_URL') ??
        'https://mempool.space/api/v1/fees/recommended',
      faucetUrl: null,
      faucetNetwork: null,
    },
    protocol: {
      masterContractId: requireEnv('EXPO_PUBLIC_MASTER_CONTRACT_ID', networkId),
      turboMintAddress: getEnv('EXPO_PUBLIC_TURBO_MINT_ADDRESS') ?? null,
    },
    runes: {
      unitId: {
        block: requireBigIntEnv('EXPO_PUBLIC_UNIT_RUNE_BLOCK', networkId),
        tx: requireBigIntEnv('EXPO_PUBLIC_UNIT_RUNE_TX', networkId),
      },
      unitLabel: getEnv('EXPO_PUBLIC_UNIT_RUNE_LABEL') ?? 'DUCAT•UNIT•RUNE',
    },
  };
}

function resolveAppNetworkConfig(): AppNetworkConfig {
  switch (resolveAppNetworkId()) {
    case 'mutinynet':
      return resolveMutinynetConfig();
    case 'mainnet':
      return resolveMainnetConfig();
  }
}

export const APP_NETWORK_CONFIG = resolveAppNetworkConfig();
