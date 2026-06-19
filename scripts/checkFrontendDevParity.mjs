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

function checkContainsAll(relativePath, entries) {
  for (const [needle, label] of entries) {
    checkContains(relativePath, needle, label);
  }
}

function checkNotContains(relativePath, needle, label) {
  check(
    !read(relativePath).includes(needle),
    `${relativePath} must not contain ${JSON.stringify(needle)} (${label})`
  );
}

function checkNotContainsAny(relativePaths, entries) {
  for (const relativePath of relativePaths) {
    for (const [needle, label] of entries) {
      checkNotContains(relativePath, needle, label);
    }
  }
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

const mutinynetNetworkConfig = [
  ['https://validator-mutinynet.dev.ducatprotocol.com', 'frontend dev mutiny validator'],
  ['https://relay-mutinynet.dev.ducatprotocol.com', 'frontend dev mutiny relay'],
  ['wss://relay-mutinynet.dev.ducatprotocol.com', 'frontend dev mutiny oracle relay websocket'],
  ['https://oracle-mutinynet.dev.ducatprotocol.com', 'frontend dev mutiny oracle/watchtower'],
  ['https://tools-mutinynet.dev.ducatprotocol.com', 'frontend dev mutiny tools'],
  ['https://explorer-mutinynet.dev.ducatprotocol.com', 'frontend dev mutiny explorer'],
  ['https://explorer-mutinynet.dev.ducatprotocol.com/api', 'frontend dev mutiny esplora API'],
  ['https://ord-mutinynet.ducatprotocol.com', 'frontend dev mutiny ord API'],
  ['wss://guardian-1-mutinynet.dev.ducatprotocol.com/ws', 'mobile default guardian endpoint'],
  ['https://faucet.ducatprotocol.com/btc/faucet', 'mobile mutiny BTC faucet'],
  [
    'a12736a47c9e8f20c863bff8c35fa7db2d79875e5812f419799da2e8ec7cd41e',
    'frontend dev oracle pubkey',
  ],
];

checkContainsAll('utils/networkConfig.ts', mutinynetNetworkConfig);
checkContainsAll('docs/FRONTEND_DEV_V3_PARITY.md', mutinynetNetworkConfig);
checkContainsAll('docs/CLIENT_SDK_MIGRATION_PLAN.md', [
  ['https://validator-mutinynet.dev.ducatprotocol.com', 'roadmap validator URL'],
  ['wss://relay-mutinynet.dev.ducatprotocol.com', 'roadmap relay websocket URL'],
  ['https://guardian-1-mutinynet.dev.ducatprotocol.com', 'roadmap guardian URL'],
  ['https://explorer-mutinynet.dev.ducatprotocol.com/api', 'roadmap esplora API URL'],
]);

checkContains(
  'services/cashu/mintClient/mintConfig.ts',
  'https://dev-cashu-mint.ducatprotocol.com',
  'TurboUNIT Cashu mint endpoint'
);
checkContains(
  'scripts/liveIntegrationDoctor.mjs',
  'https://dev-cashu-mint.ducatprotocol.com',
  'live doctor validates the TurboUNIT Cashu mint'
);
checkContains(
  'services/liquidation/constants.ts',
  'https://faucet.ducatprotocol.com/unit/faucet/test',
  'Mutinynet-only liquidation swap faucet endpoint'
);
checkContains(
  'docs/FRONTEND_DEV_V3_PARITY.md',
  'https://dev-cashu-mint.ducatprotocol.com',
  'documented TurboUNIT Cashu mint endpoint'
);
checkContains(
  'docs/FRONTEND_DEV_V3_PARITY.md',
  'https://faucet.ducatprotocol.com/unit/faucet/test',
  'documented liquidation swap endpoint'
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
checkContainsAll('services/liquidation/constants.ts', [
  ['export const LIQ_PAGE_SIZE = 250', 'full liquidation feed page size'],
  ['export const LIQ_MAX_PAGES = 10', 'full liquidation feed pagination guardrail'],
]);
checkContainsAll('services/liquidation/fetchVaults.ts', [
  ['url.searchParams.set(\'page_size\', String(LIQ_PAGE_SIZE))', 'full liquidation feed page_size query'],
  ['url.searchParams.set(\'cursor\', cursor)', 'full liquidation feed cursor pagination'],
  ['pageCount >= LIQ_MAX_PAGES', 'full liquidation feed max-page guard'],
  ['vault.quote?.is_expired === true', 'expired embedded quote filtering'],
  ['isTerminalLiquidationAction', 'already-taken liquidation filter'],
]);

const protocolActionFiles = [
  'services/vault/open.ts',
  'services/vault/borrow.ts',
  'services/vault/deposit.ts',
  'services/vault/repay.ts',
  'services/vault/withdraw.ts',
  'services/liquidation/execution.ts',
];

checkNotContainsAny(protocolActionFiles, [
  ['fetchBtcPrice', 'protocol actions must not use display BTC price fallback'],
  ['API.COINGECKO', 'protocol actions must not use CoinGecko'],
  ['CoinGecko', 'protocol actions must not use CoinGecko'],
  ['/simple/price', 'protocol actions must not call spot price APIs'],
  ['PRICE_SERVER', 'protocol actions must not use validator display price fallback'],
]);

checkContainsAll('services/vault/open.ts', [
  ['fetchPriceQuote(options.liquidationPrice)', 'open uses relay-backed oracle quote'],
  ['wallet.vault.open.ctx', 'open builds SDK context'],
  ['wallet.vault.open.quote', 'open quotes through SDK'],
  ['wallet.vault.open.req', 'open builds request through SDK'],
  ['gclient.req.vault.open', 'open submits through guardian vault endpoint'],
]);
checkContainsAll('services/vault/borrow.ts', [
  ['MAX_QUOTE_AGE_SECONDS', 'borrow enforces oracle quote freshness'],
  ['wallet.vault.borrow.ctx', 'borrow builds SDK context'],
  ['wallet.vault.borrow.quote', 'borrow quotes through SDK'],
  ['wallet.vault.borrow.req', 'borrow builds request through SDK'],
  ['gclient.req.vault.borrow', 'borrow submits through guardian vault endpoint'],
]);
checkContainsAll('services/vault/deposit.ts', [
  ['MAX_QUOTE_AGE_SECONDS', 'deposit enforces oracle quote freshness'],
  ['wallet.vault.deposit.ctx', 'deposit builds SDK context'],
  ['wallet.vault.deposit.quote', 'deposit quotes through SDK'],
  ['wallet.vault.deposit.req', 'deposit builds request through SDK'],
  ['gclient.req.vault.deposit', 'deposit submits through guardian vault endpoint'],
]);
checkContainsAll('services/vault/repay.ts', [
  ['MAX_QUOTE_AGE_SECONDS', 'repay enforces oracle quote freshness'],
  ['wallet.vault.repay.ctx', 'repay builds SDK context'],
  ['wallet.vault.repay.quote', 'repay quotes through SDK'],
  ['wallet.vault.repay.req', 'repay builds request through SDK'],
  ['gclient.req.vault.repay', 'repay submits through guardian vault endpoint'],
]);
checkContainsAll('services/vault/withdraw.ts', [
  ['MAX_QUOTE_AGE_SECONDS', 'withdraw enforces oracle quote freshness'],
  ['wallet.vault.withdraw.ctx', 'withdraw builds SDK context'],
  ['wallet.vault.withdraw.req', 'withdraw builds request through SDK'],
  ['gclient.req.vault.withdraw', 'withdraw submits through guardian vault endpoint'],
]);
checkContainsAll('services/liquidation/execution.ts', [
  ['fetchPriceQuote(liquidationPrice)', 'liquidation uses relay-backed oracle quote'],
  ['VaultAPI.repo.liquidation.get_ctx', 'liquidation builds SDK liquidation context'],
  ['wallet.vault.repo.ctx', 'repo builds SDK context'],
  ['wallet.vault.repo.quote', 'repo quotes through SDK'],
  ['VaultAPI.repo.create_request', 'repo builds request through latest SDK'],
  ['VaultAPI.trim.create_ctx', 'trim builds SDK context'],
  ['VaultAPI.trim.create_psbt', 'trim builds PSBT through latest SDK'],
  ['VaultAPI.trim.create_request', 'trim builds request through latest SDK'],
  ['guardian.req.vault.repo', 'repo submits through guardian vault endpoint'],
  ['}).trim', 'trim submits through guardian vault trim endpoint when exposed'],
  ['_client?.request?.vault?.trim', 'trim submits through guardian raw trim fallback'],
]);

const sdkActionMappings = [
  ['wallet.vault.open.ctx/quote/req', 'open action SDK mapping'],
  ['wallet.vault.borrow.ctx/quote/req', 'borrow action SDK mapping'],
  ['wallet.vault.deposit.ctx/quote/req', 'deposit action SDK mapping'],
  ['wallet.vault.repay.ctx/quote/req', 'repay action SDK mapping'],
  ['wallet.vault.withdraw.ctx/req', 'withdraw action SDK mapping'],
  ['wallet.vault.repo.ctx/quote/request', 'repo/liquidation action SDK mapping'],
  ['VaultActionAPI.trim.create_ctx/create_psbt/create_request', 'trim partial-liquidation SDK mapping'],
  ['`close` remains explicitly excluded from mobile parity', 'close action explicit mobile exclusion'],
];
checkContainsAll('docs/CLIENT_SDK_MIGRATION_PLAN.md', sdkActionMappings);
checkContainsAll('docs/FRONTEND_DEV_V3_PARITY.md', [
  ['- open', 'frontend parity action list includes open'],
  ['- borrow', 'frontend parity action list includes borrow'],
  ['- repay', 'frontend parity action list includes repay'],
  ['- deposit', 'frontend parity action list includes deposit'],
  ['- withdraw', 'frontend parity action list includes withdraw'],
  ['- repo', 'frontend parity action list includes repo'],
  ['- trim', 'frontend parity action list includes trim'],
]);

checkContains(
  'scripts/runLiveRegression.mjs',
  'scripts/liveIntegrationDoctor.mjs',
  'live regression runs the live integration doctor before Maestro'
);
checkContains(
  'package.json',
  '"doctor:live": "node scripts/liveIntegrationDoctor.mjs"',
  'release gate exposes live integration doctor'
);
checkContains(
  'package.json',
  '"verify": "npm run parity:check &&',
  'CI verify path enforces parity check before the broader gate'
);
checkContains(
  'package.json',
  '"roadmap:check": "npm run parity:check && npm run e2e:validate && DUCAT_USER_FACING_REGRESSION_REPORT_PATH=off node scripts/runUserFacingRegression.mjs --validate --enforce-complete',
  'roadmap check exposes strict read-only non-live parity and flow inventory gate'
);
checkContains(
  'package.json',
  '"e2e:real:no-usdc": "node scripts/runLiveRegression.mjs --require-confirmation testflight-no-usdc"',
  'release gate exposes maintained no-USDC live regression profile'
);
checkContains(
  'docs/FRONTEND_DEV_V3_PARITY.md',
  'Oracle-relay first',
  'documented price parity decision'
);
checkContains(
  'docs/FRONTEND_DEV_V3_PARITY.md',
  '09e0e40f68a658d544c91d2b8d306067c284d07d',
  'pinned frontend origin/dev parity baseline'
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
