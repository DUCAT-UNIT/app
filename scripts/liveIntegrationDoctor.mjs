#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readProjectEnvironment } from './loadEnv.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));

const failures = [];
const warnings = [];
const env = readProjectEnvironment({ root });

const offline = args.has('--offline') || env.DUCAT_LIVE_DOCTOR_OFFLINE === '1';
const skipTooling = args.has('--skip-tooling') || env.DUCAT_LIVE_DOCTOR_SKIP_TOOLING === '1';
const allowLocal = args.has('--allow-local') || env.DUCAT_LIVE_ALLOW_LOCAL === '1';

const DEFAULT_SEPOLIA_USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const DEFAULT_MUTINYNET_ESPLORA = 'https://mutinynet.com/api';
const DUCAT_CASHU_MINT_URL = 'https://dev-cashu-mint.ducatprotocol.com';
const MINT_CONFIG_PATH = join(root, 'services', 'cashu', 'mintClient', 'mintConfig.ts');
const REQUIRED_ADDRESS_ENV = [
  'EXPO_PUBLIC_WUNIT_ADDRESS',
  'EXPO_PUBLIC_UNIT_BRIDGE_ROUTER_ADDRESS',
  'EXPO_PUBLIC_UNIT_USDC_STABLE_POOL_ADDRESS',
];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function envValue(name) {
  const value = env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function commandExists(command, args = ['--version']) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return result.status === 0;
}

function isLocalHost(hostname) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized.endsWith('.local')
  );
}

function validateHttpUrl(name, { required = true, allowWebSocket = false } = {}) {
  const value = envValue(name);
  if (!value) {
    if (required) fail(`${name} is required for live integration runs`);
    return null;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${name} must be a valid URL`);
    return null;
  }

  const protocols = allowWebSocket ? ['http:', 'https:', 'ws:', 'wss:'] : ['http:', 'https:'];
  if (!protocols.includes(parsed.protocol)) {
    fail(`${name} must use ${allowWebSocket ? 'http(s) or ws(s)' : 'http(s)'}`);
  }

  if (!allowLocal && isLocalHost(parsed.hostname)) {
    fail(
      `${name} points at ${parsed.hostname}; set DUCAT_LIVE_ALLOW_LOCAL=1 only for intentional local bridge testing`
    );
  }

  return parsed;
}

function validateAddress(name, { required = true, defaultValue } = {}) {
  const value = envValue(name) || defaultValue || '';
  if (!value) {
    if (required) fail(`${name} is required for live integration runs`);
    return null;
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    fail(`${name} must be a 20-byte Ethereum address`);
    return null;
  }

  return value;
}

function getCashuMintUrlFromSource() {
  if (!existsSync(MINT_CONFIG_PATH)) {
    fail('Cashu mint config is missing at services/cashu/mintClient/mintConfig.ts');
    return null;
  }

  const contents = readFileSync(MINT_CONFIG_PATH, 'utf8');
  const match = contents.match(/export\s+const\s+MINT_URL\s*=\s*['"]([^'"]+)['"]/);
  if (!match) {
    fail('Cashu mint config must export MINT_URL');
    return null;
  }

  let parsed;
  try {
    parsed = new URL(match[1]);
  } catch {
    fail('Cashu MINT_URL must be a valid URL');
    return null;
  }

  if (parsed.origin !== DUCAT_CASHU_MINT_URL || parsed.pathname.replace(/\/$/, '') !== '') {
    fail(`Cashu MINT_URL must be ${DUCAT_CASHU_MINT_URL}`);
  }

  return parsed;
}

async function fetchWithTimeout(url, options = {}) {
  const timeoutMs = Number(envValue('DUCAT_LIVE_DOCTOR_TIMEOUT_MS') || 10000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function probeCashuMintInfo(cashuMintUrl) {
  if (!cashuMintUrl) return;

  const infoUrl = new URL('/v1/info', cashuMintUrl);
  try {
    const response = await fetchWithTimeout(infoUrl.toString(), { method: 'GET' });
    if (!response.ok) {
      fail(`Cashu mint /v1/info returned HTTP ${response.status}`);
      return;
    }

    const info = await response.json();
    const methods = info?.nuts?.['4']?.methods;
    if (!Array.isArray(methods)) {
      fail('Cashu mint /v1/info did not include nuts["4"].methods');
      return;
    }

    const supportsOnchainUnit = methods.some(
      (method) => method?.method === 'onchain' && method?.unit === 'unit'
    );
    if (!supportsOnchainUnit) {
      fail('Cashu mint does not advertise NUT-04 onchain/unit support');
    }
  } catch (error) {
    fail(
      `Cashu mint /v1/info probe failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function probeSepoliaRpc(rpcUrl) {
  if (!rpcUrl) return;

  try {
    const chainResponse = await fetchWithTimeout(rpcUrl.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
    });
    if (!chainResponse.ok) {
      fail(`Sepolia RPC eth_chainId returned HTTP ${chainResponse.status}`);
      return;
    }

    const chainPayload = await chainResponse.json();
    if (chainPayload.result !== '0xaa36a7') {
      fail(`Sepolia RPC chain id must be 0xaa36a7, got ${chainPayload.result ?? 'empty response'}`);
      return;
    }

    const blockResponse = await fetchWithTimeout(rpcUrl.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_blockNumber', params: [] }),
    });
    if (!blockResponse.ok) {
      fail(`Sepolia RPC eth_blockNumber returned HTTP ${blockResponse.status}`);
      return;
    }

    const blockPayload = await blockResponse.json();
    const blockNumber = Number.parseInt(String(blockPayload.result ?? ''), 16);
    if (!Number.isFinite(blockNumber) || blockNumber <= 0) {
      fail('Sepolia RPC eth_blockNumber returned an invalid block height');
    }
  } catch (error) {
    fail(`Sepolia RPC probe failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function probeBridgeApi(bridgeUrl) {
  if (!bridgeUrl) return;

  const healthUrl = new URL('/health', bridgeUrl);
  try {
    const response = await fetchWithTimeout(healthUrl.toString(), { method: 'GET' });
    if (!response.ok) {
      fail(`Bridge API health returned HTTP ${response.status}`);
      return;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      await response.json();
    }
  } catch (error) {
    fail(
      `Bridge API health probe failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function probeMutinynetEsplora() {
  const esploraUrl =
    validateHttpUrl('EXPO_PUBLIC_ESPLORA_API_URL', { required: false }) ??
    new URL(DEFAULT_MUTINYNET_ESPLORA);
  const tipUrl = new URL(`${esploraUrl.pathname.replace(/\/$/, '')}/blocks/tip/height`, esploraUrl);

  try {
    const response = await fetchWithTimeout(tipUrl.toString(), { method: 'GET' });
    if (!response.ok) {
      fail(`Mutinynet Esplora tip height returned HTTP ${response.status}`);
      return;
    }

    const height = Number((await response.text()).trim());
    if (!Number.isFinite(height) || height <= 0) {
      fail('Mutinynet Esplora tip height was not a positive number');
    }
  } catch (error) {
    fail(
      `Mutinynet Esplora probe failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function checkMutinynetOnly() {
  const network = envValue('EXPO_PUBLIC_APP_NETWORK');
  if (network && network !== 'mutinynet') {
    fail(`EXPO_PUBLIC_APP_NETWORK must stay mutinynet for live runs, got ${network}`);
  }
}

function checkRequiredConfiguration() {
  validateHttpUrl('EXPO_PUBLIC_SEPOLIA_RPC_URL');
  validateHttpUrl('EXPO_PUBLIC_UNIT_BRIDGE_API_URL');
  validateHttpUrl('EXPO_PUBLIC_GUARDIAN_WS_URL', { required: false, allowWebSocket: true });
  validateHttpUrl('EXPO_PUBLIC_ORD_API_URL', { required: false });
  validateHttpUrl('EXPO_PUBLIC_VAULT_API_URL', { required: false });
  validateHttpUrl('EXPO_PUBLIC_QUOTE_SERVER_URL', { required: false });
  validateHttpUrl('EXPO_PUBLIC_PRICE_SERVER_URL', { required: false });

  for (const name of REQUIRED_ADDRESS_ENV) {
    validateAddress(name);
  }

  if (!envValue('EXPO_PUBLIC_SEPOLIA_USDC_ADDRESS')) {
    warn(
      `EXPO_PUBLIC_SEPOLIA_USDC_ADDRESS is unset; app default ${DEFAULT_SEPOLIA_USDC} will be used`
    );
  }
  validateAddress('EXPO_PUBLIC_SEPOLIA_USDC_ADDRESS', {
    required: false,
    defaultValue: DEFAULT_SEPOLIA_USDC,
  });
}

function checkSeedWarning() {
  if (envValue('DUCAT_LIVE_E2E_SEED_PHRASE')) {
    warn(
      'DUCAT_LIVE_E2E_SEED_PHRASE is present; this script never prints it, but prefer secure local injection over shell history'
    );
  }
}

function checkTooling() {
  if (skipTooling) {
    warn('native tooling checks skipped by DUCAT_LIVE_DOCTOR_SKIP_TOOLING=1 or --skip-tooling');
    return;
  }

  if (!commandExists('maestro')) {
    fail('Maestro CLI is required before running live flows');
  }

  if (process.platform === 'darwin' && !commandExists('xcrun')) {
    fail('xcrun is required for iOS simulator live flows on macOS');
  }

  if (!existsSync(join(root, 'node_modules'))) {
    fail('node_modules is missing; run npm ci before live integration checks');
  }
}

async function checkNetworkProbes() {
  if (offline) {
    warn('network probes skipped by DUCAT_LIVE_DOCTOR_OFFLINE=1 or --offline');
    return;
  }

  const rpcUrl = validateHttpUrl('EXPO_PUBLIC_SEPOLIA_RPC_URL');
  const bridgeUrl = validateHttpUrl('EXPO_PUBLIC_UNIT_BRIDGE_API_URL');
  const cashuMintUrl = getCashuMintUrlFromSource();
  await Promise.all([
    probeSepoliaRpc(rpcUrl),
    probeBridgeApi(bridgeUrl),
    probeMutinynetEsplora(),
    probeCashuMintInfo(cashuMintUrl),
  ]);
}

checkMutinynetOnly();
checkRequiredConfiguration();
checkSeedWarning();
checkTooling();
await checkNetworkProbes();

for (const message of warnings) {
  console.warn(`live doctor warning: ${message}`);
}

if (failures.length > 0) {
  for (const message of failures) {
    console.error(`live doctor failed: ${message}`);
  }
  process.exit(1);
}

console.log(
  `live integration doctor passed${warnings.length > 0 ? ` with ${warnings.length} warning(s)` : ''}`
);
