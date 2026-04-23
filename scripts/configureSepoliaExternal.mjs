import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const appRoot = process.cwd();
const deploymentPath = join(appRoot, 'evm', 'deployments', 'sepolia.json');
const officialSepoliaUsdc = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const publicSepoliaRpc = 'https://ethereum-sepolia-rpc.publicnode.com';

if (!existsSync(deploymentPath)) {
  throw new Error(`Missing Sepolia deployment file at ${deploymentPath}. Run evm deploy first.`);
}

const deployment = JSON.parse(readFileSync(deploymentPath, 'utf8'));
const appEnvPath = join(appRoot, '.env');
const bridgeEnvPath = join(appRoot, 'bridge-service', '.env');

function upsertEnv(raw, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(raw)) {
    return raw.replace(pattern, line);
  }

  const suffix = raw.endsWith('\n') || raw.length === 0 ? '' : '\n';
  return `${raw}${suffix}${line}\n`;
}

function readEnv(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

const bridgeApiUrl = process.env.SEPOLIA_BRIDGE_API_URL?.trim();
const sepoliaRpcUrl = process.env.SEPOLIA_PUBLIC_RPC_URL || publicSepoliaRpc;

if (!bridgeApiUrl) {
  throw new Error('Missing SEPOLIA_BRIDGE_API_URL. Point this at the externally hosted bridge service.');
}

let appEnv = readEnv(appEnvPath);
for (const [key, value] of Object.entries({
  EXPO_PUBLIC_SEPOLIA_RPC_URL: sepoliaRpcUrl,
  EXPO_PUBLIC_SEPOLIA_USDC_ADDRESS: officialSepoliaUsdc,
  EXPO_PUBLIC_WUNIT_ADDRESS: deployment.wunit,
  EXPO_PUBLIC_UNIT_BRIDGE_ROUTER_ADDRESS: deployment.router,
  EXPO_PUBLIC_UNIT_USDC_STABLE_POOL_ADDRESS: deployment.pool,
  EXPO_PUBLIC_UNIT_BRIDGE_API_URL: bridgeApiUrl,
})) {
  appEnv = upsertEnv(appEnv, key, value);
}
writeFileSync(appEnvPath, appEnv);

let bridgeEnv = readEnv(bridgeEnvPath);
for (const [key, value] of Object.entries({
  PORT: '8788',
  UNIT_BRIDGE_RUNTIME_ENABLED: 'true',
  UNIT_BRIDGE_LIVE_MODE: 'true',
  UNIT_BRIDGE_PROMPT_ADMIN_TOKEN: 'true',
  UNIT_BRIDGE_SEPOLIA_RPC_URL: sepoliaRpcUrl,
  UNIT_BRIDGE_SEPOLIA_USDC_ADDRESS: officialSepoliaUsdc,
  UNIT_BRIDGE_WUNIT_ADDRESS: deployment.wunit,
  UNIT_BRIDGE_POOL_ADDRESS: deployment.pool,
  UNIT_BRIDGE_ROUTER_ADDRESS: deployment.router,
})) {
  bridgeEnv = upsertEnv(bridgeEnv, key, value);
}
writeFileSync(bridgeEnvPath, bridgeEnv);

process.stdout.write(`Configured app .env and bridge-service/.env from ${deploymentPath}\n`);
