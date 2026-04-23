import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const appRoot = process.cwd();
const deploymentPath = join(appRoot, 'evm', 'deployments', 'local-swap.json');

if (!existsSync(deploymentPath)) {
  throw new Error(`Missing deployment file at ${deploymentPath}`);
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

function writeAppEnv() {
  let raw = existsSync(appEnvPath) ? readFileSync(appEnvPath, 'utf8') : '';
  const updates = {
    EXPO_PUBLIC_SEPOLIA_RPC_URL: 'http://127.0.0.1:8545',
    EXPO_PUBLIC_SEPOLIA_USDC_ADDRESS: deployment.mockUsdc,
    EXPO_PUBLIC_WUNIT_ADDRESS: deployment.wunit,
    EXPO_PUBLIC_UNIT_BRIDGE_ROUTER_ADDRESS: deployment.router,
    EXPO_PUBLIC_UNIT_USDC_STABLE_POOL_ADDRESS: deployment.pool,
    EXPO_PUBLIC_UNIT_BRIDGE_API_URL: 'http://127.0.0.1:8788',
  };

  for (const [key, value] of Object.entries(updates)) {
    raw = upsertEnv(raw, key, value);
  }

  writeFileSync(appEnvPath, raw);
}

function writeBridgeEnv() {
  let raw = existsSync(bridgeEnvPath) ? readFileSync(bridgeEnvPath, 'utf8') : '';
  const hardhatDefaultPrivateKey =
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const updates = {
    PORT: '8788',
    UNIT_BRIDGE_RUNTIME_ENABLED: 'false',
    UNIT_BRIDGE_LIVE_MODE: 'false',
    UNIT_BRIDGE_PROMPT_ADMIN_TOKEN: 'false',
    UNIT_BRIDGE_ADMIN_TOKEN: '',
    UNIT_BRIDGE_SEPOLIA_RPC_URL: 'http://127.0.0.1:8545',
    UNIT_BRIDGE_SEPOLIA_PRIVATE_KEY: hardhatDefaultPrivateKey,
    UNIT_BRIDGE_SEPOLIA_USDC_ADDRESS: deployment.mockUsdc,
    UNIT_BRIDGE_WUNIT_ADDRESS: deployment.wunit,
    UNIT_BRIDGE_POOL_ADDRESS: deployment.pool,
    UNIT_BRIDGE_ROUTER_ADDRESS: deployment.router,
    UNIT_BRIDGE_SEPOLIA_START_BLOCK: '0',
  };

  for (const [key, value] of Object.entries(updates)) {
    raw = upsertEnv(raw, key, value);
  }

  writeFileSync(bridgeEnvPath, raw);
}

writeAppEnv();
writeBridgeEnv();

process.stdout.write(`Configured app .env and bridge-service/.env from ${deploymentPath}\n`);
