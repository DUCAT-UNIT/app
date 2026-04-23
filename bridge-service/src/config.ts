import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

function resolveServiceRoot(): string {
  return basename(process.cwd()) === 'bridge-service' ? process.cwd() : join(process.cwd(), 'bridge-service');
}

function loadBridgeEnvFile(): void {
  const envPath = join(resolveServiceRoot(), '.env');
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadBridgeEnvFile();

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getNumberEnv(name: string, fallback: number): number {
  const value = getEnv(name);
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${name}: ${value}`);
  }
  return parsed;
}

function getBooleanEnv(name: string, fallback: boolean): boolean {
  const value = getEnv(name);
  if (!value) {
    return fallback;
  }

  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Invalid boolean value for ${name}: ${value}`);
}

export const BRIDGE_CONFIG = {
  appRoot: basename(process.cwd()) === 'bridge-service' ? dirname(process.cwd()) : process.cwd(),
  serviceRoot: resolveServiceRoot(),
  stateFilePath:
    getEnv('UNIT_BRIDGE_STATE_FILE')
    || join(resolveServiceRoot(), 'data/state.json'),
  unitDecimals: 6,
  mutinynetUnitDecimals: 2,
  confirmationThreshold: getNumberEnv('UNIT_BRIDGE_MUTINYNET_CONFIRMATIONS', 1),
  sepoliaConfirmations: getNumberEnv('UNIT_BRIDGE_SEPOLIA_CONFIRMATIONS', 1),
  intentExpiryMs: getNumberEnv('UNIT_BRIDGE_INTENT_EXPIRY_MS', 1000 * 60 * 60 * 24),
  pollIntervalMs: getNumberEnv('UNIT_BRIDGE_POLL_INTERVAL_MS', 5_000),
  activeIntentScanWindowMs: getNumberEnv('UNIT_BRIDGE_ACTIVE_INTENT_SCAN_WINDOW_MS', 1000 * 60 * 30),
  abandonedIntentExpiryMs: getNumberEnv('UNIT_BRIDGE_ABANDONED_INTENT_EXPIRY_MS', 1000 * 60 * 30),
  defaultAmplification: 200,
  defaultSwapFeeBps: 4,
  defaultSwapSlippageBps: getNumberEnv('UNIT_BRIDGE_SWAP_SLIPPAGE_BPS', 100),
  sepoliaUsdcAddress: getEnv('UNIT_BRIDGE_SEPOLIA_USDC_ADDRESS') || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  adminDashboardPath: '/admin',
  adminToken: getEnv('UNIT_BRIDGE_ADMIN_TOKEN') || '',
  adminUiTokenPrompt: getBooleanEnv('UNIT_BRIDGE_PROMPT_ADMIN_TOKEN', true),
  runtimeEnabled: getBooleanEnv('UNIT_BRIDGE_RUNTIME_ENABLED', true),
  liveMode: getBooleanEnv('UNIT_BRIDGE_LIVE_MODE', false),
  mutinynet: {
    esploraBaseUrl: getEnv('UNIT_BRIDGE_MUTINYNET_ESPLORA_URL') || 'https://mutinynet.com/api',
    ordBaseUrl: getEnv('UNIT_BRIDGE_MUTINYNET_ORD_URL') || 'https://ord-mutinynet.ducatprotocol.com',
    faucetUrl: getEnv('UNIT_BRIDGE_MUTINYNET_FAUCET_URL') || 'https://faucet.ducatprotocol.com/btc/faucet',
    feeRecommendationsUrl:
      getEnv('UNIT_BRIDGE_FEE_RECOMMENDATIONS_URL') || 'https://mempool.space/testnet/api/v1/fees/recommended',
    unitRuneLabel: getEnv('UNIT_BRIDGE_UNIT_RUNE_LABEL') || 'DUCAT•UNIT•RUNE',
    bridgeMnemonic: getEnv('UNIT_BRIDGE_MUTINYNET_MNEMONIC') || '',
    bridgeAccount: getNumberEnv('UNIT_BRIDGE_MUTINYNET_ACCOUNT', 777),
    feeAddressIndex: getNumberEnv('UNIT_BRIDGE_MUTINYNET_FEE_INDEX', 0),
  },
  sepolia: {
    rpcUrl: getEnv('UNIT_BRIDGE_SEPOLIA_RPC_URL') || '',
    privateKey: getEnv('UNIT_BRIDGE_SEPOLIA_PRIVATE_KEY') || '',
    chainId: getNumberEnv('UNIT_BRIDGE_SEPOLIA_CHAIN_ID', 11_155_111),
    wunitAddress: getEnv('UNIT_BRIDGE_WUNIT_ADDRESS') || '',
    poolAddress: getEnv('UNIT_BRIDGE_POOL_ADDRESS') || '',
    routerAddress: getEnv('UNIT_BRIDGE_ROUTER_ADDRESS') || '',
    startBlock: getNumberEnv('UNIT_BRIDGE_SEPOLIA_START_BLOCK', 0),
  },
} as const;

export const isBridgeAdminAuthEnabled = (): boolean => BRIDGE_CONFIG.adminToken.length > 0;

export const isLiveBridgeRuntimeConfigured = (): boolean => {
  return Boolean(
    BRIDGE_CONFIG.liveMode &&
    BRIDGE_CONFIG.mutinynet.bridgeMnemonic &&
    BRIDGE_CONFIG.sepolia.rpcUrl &&
    BRIDGE_CONFIG.sepolia.privateKey &&
    BRIDGE_CONFIG.sepolia.wunitAddress &&
    BRIDGE_CONFIG.sepolia.poolAddress &&
    BRIDGE_CONFIG.sepolia.routerAddress,
  );
};
