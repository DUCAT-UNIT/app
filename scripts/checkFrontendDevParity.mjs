#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const failures = [];

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function check(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function checkContains(relativePath, needle, label) {
  check(
    read(relativePath).includes(needle),
    `${relativePath} must contain ${JSON.stringify(needle)} (${label})`
  );
}

function checkPackageVersion(relativePath, expectedName, expectedVersion) {
  const manifest = readJson(relativePath);
  check(
    manifest.name === expectedName,
    `${relativePath} package name drifted: expected ${expectedName}, got ${manifest.name}`
  );
  check(
    manifest.version === expectedVersion,
    `${relativePath} version drifted from frontend dev parity: expected ${expectedVersion}, got ${manifest.version}`
  );
}

const appPackage = readJson('package.json');
check(
  appPackage.dependencies?.['@ducat-unit/client-sdk'] === 'file:vendor/ducat-unit-client-sdk',
  'package.json must use the vendored @ducat-unit/client-sdk package'
);
check(
  appPackage.dependencies?.['@ducat-unit/core'] === 'file:vendor/ducat-unit-core',
  'package.json must use the vendored @ducat-unit/core package'
);
check(
  appPackage.dependencies?.['@ducat-unit/runestone'] === 'file:vendor/ducat-unit-runestone',
  'package.json must use the vendored @ducat-unit/runestone package'
);

checkPackageVersion('vendor/ducat-unit-client-sdk/package.json', '@ducat-unit/client-sdk', '0.25.2');
checkPackageVersion('vendor/ducat-unit-core/package.json', '@ducat-unit/core', '0.22.1');
checkPackageVersion('vendor/ducat-unit-runestone/package.json', '@ducat-unit/runestone', '2.0.11');

checkContains(
  'utils/networkConfig.ts',
  'https://validator-mutinynet.dev.ducatprotocol.com',
  'frontend dev mutiny validator'
);
checkContains(
  'utils/networkConfig.ts',
  'wss://relay-mutinynet.dev.ducatprotocol.com',
  'frontend dev mutiny oracle relay'
);
checkContains(
  'utils/networkConfig.ts',
  'a12736a47c9e8f20c863bff8c35fa7db2d79875e5812f419799da2e8ec7cd41e',
  'frontend dev oracle pubkey'
);
checkContains(
  'utils/networkConfig.ts',
  'wss://guardian-1-mutinynet.dev.ducatprotocol.com/ws',
  'mobile default guardian endpoint'
);

const balanceService = read('services/balanceService.ts');
const relayPriceIndex = balanceService.indexOf('fetchCurrentPrice()');
const validatorPriceIndex = balanceService.indexOf('const ducatPriceUrl');
check(relayPriceIndex >= 0, 'services/balanceService.ts must call fetchCurrentPrice for oracle-relay BTC price parity');
check(validatorPriceIndex >= 0, 'services/balanceService.ts must keep validator price fallback');
check(
  relayPriceIndex >= 0 && validatorPriceIndex >= 0 && relayPriceIndex < validatorPriceIndex,
  'services/balanceService.ts must try oracle-relay BTC price before validator/CoinGecko fallback'
);

checkContains(
  'services/oracleService.ts',
  'const socket = new WebSocketCtor(API.RELAY_WS)',
  'oracle price quote transport must use configured relay websocket'
);
checkContains(
  'services/oracleService.ts',
  'export const MAX_QUOTE_AGE_SECONDS = 5 * 60',
  'guardian-compatible oracle quote freshness'
);
checkContains(
  'services/liquidation/fetchVaults.ts',
  '/api/liquid/vaults',
  'intentional mobile full liquidation feed'
);
checkContains(
  'services/liquidation/fetchVaults.ts',
  'isTerminalLiquidationAction',
  'already-taken liquidation filter'
);
checkContains(
  'docs/FRONTEND_DEV_V3_PARITY.md',
  'Oracle-relay first',
  'documented price parity decision'
);
checkContains(
  'docs/FRONTEND_DEV_V3_PARITY.md',
  '/api/liquid/vaults',
  'documented liquidation feed decision'
);

if (failures.length > 0) {
  console.error('Frontend dev v3 parity check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Frontend dev v3 parity check passed.');
