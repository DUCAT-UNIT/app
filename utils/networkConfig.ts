import type { Network } from 'bitcoinjs-lib';
import type { ChainNetwork } from '@ducat-unit/client-sdk';

export type AppNetworkId = 'mutinynet';

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
    validatorUrl: string;
    relayUrl: string;
    relayWsUrl: string;
    oraclePubkey: string;
    oracleUrl: string;
    toolsUrl: string;
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
    quantaUrl: string;
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

function requireHttpsUrl(name: string, value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid URL value for ${name}: ${value}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS`);
  }

  return parsed.toString().replace(/\/$/, '');
}

function assertMutinynetOnlyConfig(): void {
  const configured = getEnv('EXPO_PUBLIC_APP_NETWORK');
  if (configured && configured !== 'mutinynet') {
    throw new Error(
      `DUCAT mobile is Mutinynet-only. Unsupported EXPO_PUBLIC_APP_NETWORK value "${configured}".`
    );
  }
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
  assertMutinynetOnlyConfig();
  const unitLabel = getEnv('EXPO_PUBLIC_UNIT_RUNE_LABEL') ?? 'DUCAT•UNIT•RUNE';
  const validatorUrl = requireHttpsUrl(
    'EXPO_PUBLIC_VALIDATOR_URL',
    getEnv('EXPO_PUBLIC_VALIDATOR_URL') ?? 'https://validator-mutinynet.dev.ducatprotocol.com'
  );

  return {
    id: 'mutinynet',
    displayName: 'Mutinynet',
    editionLabel: 'Mutinynet Network',
    isTestNetwork: true,
    bitcoinjs: MUTINYNET_BITCOIN_NETWORK,
    coinType: 1,
    vaultSdkNetwork: 'mutiny',
    addressPrefixes: buildAddressPrefixes('tb', ['2', 'm', 'n'], 'mainnet', 'bc', ['3', '1']),
    api: {
      validatorUrl,
      relayUrl: getEnv('EXPO_PUBLIC_RELAY_URL') ?? 'https://relay-mutinynet.dev.ducatprotocol.com',
      relayWsUrl:
        getEnv('EXPO_PUBLIC_RELAY_WS_URL') ?? 'wss://relay-mutinynet.dev.ducatprotocol.com',
      oraclePubkey:
        getEnv('EXPO_PUBLIC_ORACLE_PUBKEY') ??
        'a12736a47c9e8f20c863bff8c35fa7db2d79875e5812f419799da2e8ec7cd41e',
      oracleUrl:
        getEnv('EXPO_PUBLIC_ORACLE_URL') ?? 'https://oracle-mutinynet.dev.ducatprotocol.com',
      toolsUrl: getEnv('EXPO_PUBLIC_TOOLS_URL') ?? 'https://tools-mutinynet.dev.ducatprotocol.com',
      explorerBaseUrl:
        getEnv('EXPO_PUBLIC_EXPLORER_URL') ??
        'https://explorer-mutinynet.dev.ducatprotocol.com',
      esploraApiUrl:
        getEnv('EXPO_PUBLIC_ESPLORA_API_URL') ??
        'https://explorer-mutinynet.dev.ducatprotocol.com/api',
      ordUrl: getEnv('EXPO_PUBLIC_ORD_API_URL') ?? 'https://ord-mutinynet.ducatprotocol.com',
      guardianWs:
        getEnv('EXPO_PUBLIC_GUARDIAN_WS_URL') ??
        'wss://guardian-1-mutinynet.dev.ducatprotocol.com/ws',
      quoteServer: getEnv('EXPO_PUBLIC_QUOTE_SERVER_URL') ?? validatorUrl,
      priceServer: getEnv('EXPO_PUBLIC_PRICE_SERVER_URL') ?? validatorUrl,
      vaultUrl: requireHttpsUrl(
        'EXPO_PUBLIC_VAULT_API_URL',
        getEnv('EXPO_PUBLIC_VAULT_API_URL') ?? `${validatorUrl}/api`
      ),
      phoneUrl: getEnv('EXPO_PUBLIC_PHONE_URL') ?? 'https://phone.ducatprotocol.com',
      coingeckoUrl: 'https://api.coingecko.com/api/v3',
      feeRecommendationsUrl:
        getEnv('EXPO_PUBLIC_FEE_RECOMMENDATIONS_URL') ??
        'https://mempool.space/testnet/api/v1/fees/recommended',
      faucetUrl: getEnv('EXPO_PUBLIC_FAUCET_URL') ?? 'https://faucet.ducatprotocol.com/btc/faucet',
      faucetNetwork: 'mutinynet',
      quantaUrl: getEnv('EXPO_PUBLIC_QUANTA_API_URL') ?? 'https://points.ducatprotocol.com',
    },
    protocol: {
      masterContractId:
        getEnv('EXPO_PUBLIC_MASTER_CONTRACT_ID') ??
        '4c7a39a8e71b5d891fe5321a2e6fc6cf72039c60096ee63f591ecc7ecfaba115',
      turboMintAddress:
        getEnv('EXPO_PUBLIC_TURBO_MINT_ADDRESS') ??
        'tb1p7p74tg67aaw94vz2kewzeyuq80x0a65wpgegnat98f5hkcnpfjsqntv2em',
    },
    runes: {
      unitId: {
        block: getBigIntEnv('EXPO_PUBLIC_UNIT_RUNE_BLOCK') ?? 3007902n,
        tx: getBigIntEnv('EXPO_PUBLIC_UNIT_RUNE_TX') ?? 1n,
      },
      unitLabel,
    },
  };
}

export const APP_NETWORK_CONFIG = resolveMutinynetConfig();
