#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { loadProjectEnvironment } from './loadEnv.mjs';
import {
  checkBridgePoolLiquidity,
  checkLiquidationAvailability,
  checkMutinynetReviewerFunding,
  checkSepoliaReviewerFunding,
  deriveReviewerFixture,
} from './liveFixtureChecks.mjs';

loadProjectEnvironment();

const DEFAULT_REPORT_PATH = 'artifacts/live-regression/last-run.json';
const DEFAULT_PROFILE = 'repay-turbounit';
const DEFAULT_ESPLORA_API_URL = 'https://explorer-mutinynet.dev.ducatprotocol.com/api';
const DEFAULT_MEMPOOL_TIMEOUT_MS = 90_000;
const DEFAULT_CONFIRMATION_TIMEOUT_MS = 15 * 60_000;
const DEFAULT_CONFIRMATION_POLL_MS = 10_000;
const DEFAULT_EVM_TIMEOUT_MS = 10 * 60_000;
const DEFAULT_EVM_POLL_MS = 10_000;
const DEFAULT_LIQUIDATION_INVEST_BTC = '0.00001';
const DEFAULT_SEPOLIA_SEND_AMOUNT = '0.01';
const DEFAULT_SEPOLIA_SWAP_AMOUNT = '0.01';
const DEFAULT_SEPOLIA_REDEEM_AMOUNT = '0.01';
const SIMCTL_COMMAND_TIMEOUT_MS = 5_000;
const TXID_HEX_PATTERN = /^[0-9a-f]{64}$/i;
const EVM_TX_HASH_PATTERN = /^0x[0-9a-f]{64}$/i;

const PROFILES = {
  'receive-btc': {
    description: 'Create a live wallet, receive faucet BTC, and verify the receive surface.',
    flows: ['e2e/maestro/flows/test/live-receive-btc-airdrop.yaml'],
  },
  'send-btc': {
    description: 'Create a live wallet, sign, broadcast, and verify a BTC send.',
    flows: ['e2e/maestro/flows/test/live-send-btc.yaml'],
  },
  'send-btc-relaunch-pending': {
    description:
      'Submit a live BTC send, relaunch before confirmation, and verify pending recovery.',
    flows: ['e2e/maestro/flows/test/live-send-btc-relaunch-pending.yaml'],
  },
  'send-unit': {
    description: 'Create a live vault, issue UNIT, then sign, broadcast, and verify a UNIT send.',
    flows: ['e2e/maestro/flows/test/live-send-unit.yaml'],
  },
  'send-unit-relaunch-pending': {
    description:
      'Submit a live UNIT send, relaunch before confirmation, and verify pending recovery.',
    flows: ['e2e/maestro/flows/test/live-send-unit-relaunch-pending.yaml'],
  },
  'vault-actions': {
    description: 'Run live vault open, deposit, borrow, repay, and withdraw actions.',
    flows: ['e2e/maestro/flows/test/live-vault-actions.yaml'],
  },
  'vault-open-relaunch-pending': {
    description:
      'Submit a live vault open, relaunch before confirmation, and verify vault lock recovery.',
    flows: ['e2e/maestro/flows/test/live-vault-open-relaunch-pending.yaml'],
  },
  'vault-deposit-relaunch-pending': {
    description:
      'Submit a live vault deposit, relaunch before confirmation, and verify vault lock recovery.',
    flows: ['e2e/maestro/flows/test/live-vault-deposit-relaunch-pending.yaml'],
  },
  'vault-borrow-relaunch-pending': {
    description:
      'Submit a live UNIT borrow, relaunch before confirmation, and verify vault lock recovery.',
    flows: ['e2e/maestro/flows/test/live-vault-borrow-relaunch-pending.yaml'],
  },
  'repay-turbounit': {
    description: 'Create a live vault, mint TurboUNIT, and repay a tiny amount with TurboUNIT.',
    flows: ['e2e/maestro/flows/test/live-vault-turbounit-repay.yaml'],
  },
  'vault-borrow-turbounit': {
    description: 'Borrow from a live vault and settle the issued UNIT into TurboUNIT.',
    flows: ['e2e/maestro/flows/test/live-vault-borrow-turbounit.yaml'],
  },
  'vault-open-turbounit-relaunch-pending': {
    description:
      'Submit a live vault open to TurboUNIT, relaunch before confirmation, and verify recovery.',
    flows: ['e2e/maestro/flows/test/live-vault-open-turbounit-relaunch-pending.yaml'],
  },
  'vault-borrow-turbounit-relaunch-pending': {
    description:
      'Submit a live borrow-to-TurboUNIT, relaunch before confirmation, and verify recovery.',
    flows: ['e2e/maestro/flows/test/live-vault-borrow-turbounit-relaunch-pending.yaml'],
  },
  'vault-repay-turbounit-relaunch-pending': {
    description:
      'Submit a live TurboUNIT-funded repay, relaunch before confirmation, and verify recovery.',
    flows: ['e2e/maestro/flows/test/live-vault-repay-turbounit-relaunch-pending.yaml'],
  },
  'turbo-smoke': {
    description: 'Create a live vault and mint a TurboUNIT token.',
    flows: ['e2e/maestro/flows/test/live-turbounit-smoke.yaml'],
  },
  'vault-usdc-lifecycle': {
    description: 'Create a live vault settled to USDC, then repay from USDC.',
    flows: ['e2e/maestro/flows/test/live-vault-full-usdc-lifecycle.yaml'],
  },
  'vault-second-repay': {
    description: 'Create a live vault and run two consecutive UNIT repayments.',
    flows: ['e2e/maestro/flows/test/live-vault-second-repay.yaml'],
  },
  'vault-repay-relaunch-pending': {
    description:
      'Submit a live vault repay, relaunch before confirmation, and verify vault lock recovery.',
    flows: ['e2e/maestro/flows/test/live-vault-repay-relaunch-pending.yaml'],
  },
  'vault-withdraw-relaunch-pending': {
    description:
      'Submit a live vault withdrawal, relaunch before confirmation, and verify vault lock recovery.',
    flows: ['e2e/maestro/flows/test/live-vault-withdraw-relaunch-pending.yaml'],
  },
  'liquidation-feed': {
    description:
      'Verify the live liquidation validator feed has claimable vaults without claiming one.',
    flows: [],
    expectChainTxids: false,
  },
  'liquidation-execution': {
    description: 'Claim a live liquidation, capture claim/swap txids, and verify confirmation.',
    flows: ['e2e/maestro/flows/test/live-liquidation-execution.yaml'],
  },
  'deep-link-recovery': {
    description:
      'Cold-start the app from Cashu and TurboUNIT token links and prove claim recovery.',
    flows: [
      'e2e/maestro/flows/test/live-deeplink-cashu-token.yaml',
      'e2e/maestro/flows/test/live-deeplink-turbounit-token.yaml',
    ],
    expectChainTxids: false,
    requiredEvents: ['cashu_token_claimed'],
    requiredEnv: ['DUCAT_LIVE_CASHU_TOKEN_URL', 'DUCAT_LIVE_TURBOUNIT_TOKEN_URL'],
  },
  'sepolia-send-swap-redeem': {
    description: 'Run live Sepolia USDC send, swap, and redeem with EVM receipt verification.',
    flows: ['e2e/maestro/flows/test/live-sepolia-send-swap-redeem.yaml'],
    expectEvmTxHashes: true,
    requiredEnv: [
      'DUCAT_LIVE_SEPOLIA_RECIPIENT',
      'DUCAT_LIVE_SEPOLIA_SEND_AMOUNT',
      'DUCAT_LIVE_SEPOLIA_SWAP_AMOUNT',
      'DUCAT_LIVE_SEPOLIA_REDEEM_AMOUNT',
    ],
    requiredEnvAny: [['DUCAT_LIVE_SEPOLIA_RPC_URL', 'EXPO_PUBLIC_SEPOLIA_RPC_URL']],
  },
};

const PROFILE_GROUPS = {
  quick: ['repay-turbounit'],
  all: ['repay-turbounit', 'vault-usdc-lifecycle', 'vault-second-repay'],
  'relaunch-recovery': [
    'send-btc-relaunch-pending',
    'send-unit-relaunch-pending',
    'vault-open-relaunch-pending',
    'vault-deposit-relaunch-pending',
    'vault-borrow-relaunch-pending',
    'vault-repay-relaunch-pending',
    'vault-withdraw-relaunch-pending',
    'vault-open-turbounit-relaunch-pending',
    'vault-borrow-turbounit-relaunch-pending',
    'vault-repay-turbounit-relaunch-pending',
  ],
  'testflight-no-usdc': [
    'receive-btc',
    'send-btc',
    'send-unit',
    'vault-actions',
    'vault-borrow-turbounit',
    'repay-turbounit',
    'vault-second-repay',
    'liquidation-feed',
    'relaunch-recovery',
  ],
  real: [
    'receive-btc',
    'send-btc',
    'send-unit',
    'vault-actions',
    'repay-turbounit',
    'vault-usdc-lifecycle',
    'vault-second-repay',
    'relaunch-recovery',
    'liquidation-execution',
    'deep-link-recovery',
    'sepolia-send-swap-redeem',
  ],
};

const WATCH_PHASES = [
  {
    name: 'vault request preparation',
    timeoutMs: 45_000,
    start: /\[(use[A-Za-z]+Vault)\] Preparing vault request/,
    clear: [
      /\[(use[A-Za-z]+Vault)\] Vault profile ready for request/,
      /\[(use[A-Za-z]+Vault)\] Connecting to guardian/,
    ],
  },
  {
    name: 'guardian connection',
    timeoutMs: 35_000,
    start: /\[(use[A-Za-z]+Vault)\] Connecting to guardian/,
    clear: [
      /\[(use[A-Za-z]+Vault)\] Guardian connected/,
      /\[(use[A-Za-z]+Vault)\] Guardian reservation ready/,
    ],
  },
  {
    name: 'vault transaction build',
    timeoutMs: 120_000,
    start: /\[(use[A-Za-z]+Vault)\] Building vault transaction request/,
    clear: [/\[(use[A-Za-z]+Vault)\] Vault request built/],
  },
  {
    name: 'guardian submit',
    timeoutMs: 90_000,
    start: /\[(use[A-Za-z]+Vault)\] Submitting vault request to guardian/,
    clear: [
      /\[(use[A-Za-z]+Vault)\] Guardian submit finished/,
      /\[(use[A-Za-z]+Vault)\] Operation completed successfully/,
    ],
  },
  {
    name: 'TurboUNIT repay quote/melt',
    timeoutMs: 60_000,
    start: /\[VaultRepayFromUsdc\] TurboUNIT funding selected, using Cashu melt quote/,
    clear: [
      /\[VaultRepayFromUsdc\] TurboUNIT melt submitted/,
      /\[VaultRepayFromUsdc\] Resuming existing TurboUNIT melt/,
      /\[VaultRepayFromUsdc\] Recovered accepted TurboUNIT melt quote/,
    ],
  },
  {
    name: 'TurboUNIT repay release',
    timeoutMs: 180_000,
    start:
      /\[VaultRepayFromUsdc\] (TurboUNIT melt submitted|Resuming existing TurboUNIT melt|Recovered accepted TurboUNIT melt quote)/,
    clear: [
      /\[VaultRepayFromUsdc\] Released UNIT available for raw repay/,
      /\[(use[A-Za-z]+Vault)\] Building vault transaction request/,
    ],
  },
  {
    name: 'preferred TurboUNIT UTXO selection',
    timeoutMs: 240_000,
    start:
      /\[VaultOps\] (Using preferred TurboUNIT melt UTXOs for repay|Preferred TurboUNIT melt UTXO not ready, retrying)/,
    clear: [
      /\[VaultOps\] Checked preferred TurboUNIT melt UTXOs for repay/,
      /\[(use[A-Za-z]+Vault)\] Vault request built/,
    ],
  },
  {
    name: 'send intent preparation',
    timeoutMs: 120_000,
    start: /\[SendProcessing\] Creating transaction intent asset=([A-Za-z_]+)/,
    clear: [/\[SendProcessing\] Transaction intent ready asset=/],
  },
  {
    name: 'send signing and broadcast',
    timeoutMs: 120_000,
    start: /\[SendProcessing\] Signing and broadcasting transaction asset=([A-Za-z_]+)/,
    clear: [
      /\[SendProcessing\] Transaction broadcast ready asset=/,
      /\[E2E_TX\]\s+(send_broadcasted|send_confirmed)/,
    ],
  },
];

const args = process.argv.slice(2);
const options = new Set(args.filter((arg) => arg.startsWith('--')));
const profileArgs = args.filter((arg) => !arg.startsWith('--'));

if (options.has('--help') || options.has('-h')) {
  console.log(`Usage: node scripts/runLiveRegression.mjs [profile ...]

Profiles:
${Object.entries(PROFILES)
  .map(([name, profile]) => `  ${name.padEnd(20)} ${profile.description}`)
  .join('\n')}
  quick                Alias for repay-turbounit
  all                  repay-turbounit + vault-usdc-lifecycle + vault-second-repay
  relaunch-recovery    Submitted send, vault action, and TurboUNIT relaunch recovery flows
  testflight-no-usdc   Strict reviewer-data suite without USDC/Sepolia flows
  real                 Strict receive, send, vault, Turbo, USDC, liquidation, link, Sepolia suite

Options:
  --list               Print available profiles.
  --skip-doctor        Skip scripts/liveIntegrationDoctor.mjs.
  --require-confirmation
                       Verify every emitted on-chain txid reaches one confirmation.
  --no-chain-verify    Do not verify emitted txids with Esplora.

The runner wraps scripts/runMaestroLive.mjs and fails if watched transaction
phases stay stuck too long. It also parses [E2E_TX] app breadcrumbs and verifies
Mutinynet txids through Esplora plus Sepolia tx hashes through JSON-RPC unless
--no-chain-verify is used. Report path defaults to ${DEFAULT_REPORT_PATH}.`);
  process.exit(0);
}

if (options.has('--list')) {
  for (const [name, profile] of Object.entries(PROFILES)) {
    console.log(`${name}: ${profile.description}`);
  }
  console.log('quick: Alias for repay-turbounit');
  console.log('all: repay-turbounit + vault-usdc-lifecycle + vault-second-repay');
  console.log(
    'relaunch-recovery: Submitted send, vault action, and TurboUNIT relaunch recovery flows'
  );
  console.log(
    'testflight-no-usdc: Strict TestFlight reviewer-data suite without USDC/Sepolia flows'
  );
  console.log('real: Strict receive, send, vault, Turbo, USDC, liquidation, link, Sepolia suite');
  process.exit(0);
}

function expandProfile(name, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);

  const group = PROFILE_GROUPS[name];
  if (group) {
    return group.flatMap((child) => expandProfile(child, seen));
  }

  const profile = PROFILES[name];
  if (!profile) {
    throw new Error(`Unknown live regression profile "${name}". Run with --list to see options.`);
  }
  return [name];
}

const selectedProfiles = (profileArgs.length > 0 ? profileArgs : [DEFAULT_PROFILE]).flatMap(
  (name) => expandProfile(name)
);
const appliedProfileDefaults = applyProfileDefaults(selectedProfiles);
const selectedFlows = [
  ...new Set(selectedProfiles.flatMap((profileName) => PROFILES[profileName].flows)),
];
const selectedProfilesExpectChainTxids = selectedProfiles.some(
  (profileName) => PROFILES[profileName].expectChainTxids !== false
);
const selectedProfilesExpectEvmTxHashes = selectedProfiles.some(
  (profileName) => PROFILES[profileName].expectEvmTxHashes === true
);
const requireConfirmation =
  options.has('--require-confirmation') ||
  process.env.DUCAT_LIVE_REQUIRE_CONFIRMATION === '1' ||
  process.env.DUCAT_LIVE_REQUIRE_CONFIRMATIONS === '1';
const verifyChain =
  !options.has('--no-chain-verify') && process.env.DUCAT_LIVE_VERIFY_CHAIN !== 'false';
const sepoliaRpcUrl = (
  process.env.DUCAT_LIVE_SEPOLIA_RPC_URL ||
  process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL ||
  ''
).trim();

const startedAtMs = Date.now();
const report = {
  schemaVersion: 1,
  kind: 'ducat.live-regression',
  startedAt: new Date(startedAtMs).toISOString(),
  finishedAt: null,
  durationMs: null,
  profiles: selectedProfiles,
  flows: selectedFlows,
  result: 'running',
  error: null,
  chainVerification: {
    enabled: verifyChain,
    requireConfirmation,
    esploraApiUrl: (
      process.env.DUCAT_LIVE_ESPLORA_API_URL ||
      process.env.EXPO_PUBLIC_ESPLORA_API_URL ||
      DEFAULT_ESPLORA_API_URL
    ).replace(/\/+$/, ''),
    results: [],
  },
  evmVerification: {
    enabled: verifyChain && Boolean(sepoliaRpcUrl),
    requireConfirmation,
    rpcUrl: sepoliaRpcUrl || null,
    results: [],
  },
  profileRequirements: {
    missing: [],
  },
  fixtureVerification: {
    defaultsApplied: appliedProfileDefaults,
    checks: [],
  },
  receiveAddressVerification: {
    enabled: selectedProfiles.includes('receive-btc'),
    simulator: process.env.DUCAT_LIVE_SIMULATOR_UDID || process.env.MAESTRO_DEVICE || 'booted',
    address: null,
    txids: [],
    error: null,
  },
  clipboardTxidVerification: {
    enabled: true,
    simulator: process.env.DUCAT_LIVE_SIMULATOR_UDID || process.env.MAESTRO_DEVICE || 'booted',
    txid: null,
    error: null,
  },
  simulatorPendingTransactionVerification: {
    enabled: true,
    simulator: process.env.DUCAT_LIVE_SIMULATOR_UDID || process.env.MAESTRO_DEVICE || 'booted',
    txids: [],
    error: null,
  },
  e2eEvents: [],
  chainTxids: {},
  evmTxHashes: {},
  phaseEvents: [],
  activeAtExit: [],
};

const activePhases = new Map();
let child = null;
let failed = false;
let watchedPhaseStartCount = 0;
let stdoutBuffer = '';
let stderrBuffer = '';
let watchdogTimer = null;

function writeReport() {
  const reportPath = process.env.DUCAT_LIVE_REGRESSION_REPORT_PATH || DEFAULT_REPORT_PATH;
  if (reportPath === 'off' || reportPath === 'false') return;

  report.finishedAt = new Date().toISOString();
  report.durationMs = Date.now() - startedAtMs;
  report.activeAtExit = [...activePhases.values()].map((entry) => ({
    name: entry.phase.name,
    operation: entry.operation,
    startedAt: entry.startedAt,
    timeoutMs: entry.phase.timeoutMs,
    lastLine: entry.lastLine,
  }));

  const absolutePath = resolve(process.cwd(), reportPath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(`${absolutePath}.tmp`, `${JSON.stringify(report, null, 2)}\n`);
  renameSync(`${absolutePath}.tmp`, absolutePath);
  console.log(`Live regression report written to ${reportPath}`);
}

function validateProfileRequirements() {
  const missing = [];

  for (const profileName of selectedProfiles) {
    const profile = PROFILES[profileName];
    for (const key of profile.requiredEnv ?? []) {
      if (!process.env[key]) {
        missing.push({ profile: profileName, type: 'env', key });
      }
    }

    for (const group of profile.requiredEnvAny ?? []) {
      if (!group.some((key) => process.env[key])) {
        missing.push({ profile: profileName, type: 'env_any', keys: group });
      }
    }
  }

  report.profileRequirements.missing = missing;
  if (missing.length === 0) return;

  const formatted = missing
    .map((item) => {
      if (item.type === 'env_any') {
        return `${item.profile}: one of ${item.keys.join(', ')}`;
      }
      return `${item.profile}: ${item.key}`;
    })
    .join('; ');

  throw new Error(`Missing live regression prerequisites: ${formatted}`);
}

function applyProfileDefaults(profileNames) {
  const defaults = {};

  if (
    profileNames.includes('liquidation-execution') &&
    !process.env.DUCAT_LIVE_LIQUIDATION_INVEST_BTC
  ) {
    process.env.DUCAT_LIVE_LIQUIDATION_INVEST_BTC = DEFAULT_LIQUIDATION_INVEST_BTC;
    defaults.DUCAT_LIVE_LIQUIDATION_INVEST_BTC = DEFAULT_LIQUIDATION_INVEST_BTC;
  }

  if (!profileNames.includes('sepolia-send-swap-redeem')) return defaults;

  if (!process.env.DUCAT_LIVE_SEPOLIA_RECIPIENT) {
    const reviewer = deriveReviewerFixture(process.env);
    process.env.DUCAT_LIVE_SEPOLIA_RECIPIENT = reviewer.evmAddress;
    defaults.DUCAT_LIVE_SEPOLIA_RECIPIENT = 'reviewer-fixture-evm-address';
  }

  const amountDefaults = {
    DUCAT_LIVE_SEPOLIA_SEND_AMOUNT: DEFAULT_SEPOLIA_SEND_AMOUNT,
    DUCAT_LIVE_SEPOLIA_SWAP_AMOUNT: DEFAULT_SEPOLIA_SWAP_AMOUNT,
    DUCAT_LIVE_SEPOLIA_REDEEM_AMOUNT: DEFAULT_SEPOLIA_REDEEM_AMOUNT,
  };

  for (const [key, value] of Object.entries(amountDefaults)) {
    if (process.env[key]) continue;
    process.env[key] = value;
    defaults[key] = value;
  }

  return defaults;
}

function numericEnv(name, fallback) {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function validateLiveFixtureFunding() {
  const checks = [];
  const needsReviewerMutinynet = selectedProfiles.some((profileName) =>
    [
      'send-unit',
      'send-btc-relaunch-pending',
      'send-unit-relaunch-pending',
      'vault-actions',
      'vault-deposit-relaunch-pending',
      'vault-borrow-relaunch-pending',
      'repay-turbounit',
      'vault-borrow-turbounit',
      'vault-borrow-turbounit-relaunch-pending',
      'vault-repay-turbounit-relaunch-pending',
      'turbo-smoke',
      'vault-second-repay',
      'vault-repay-relaunch-pending',
      'vault-withdraw-relaunch-pending',
      'liquidation-execution',
      'deep-link-recovery',
    ].includes(profileName)
  );
  const needsSepoliaWallet = selectedProfiles.includes('sepolia-send-swap-redeem');
  const needsLiquidationAvailability = selectedProfiles.some((profileName) =>
    ['liquidation-feed', 'liquidation-execution'].includes(profileName)
  );
  const needsBridgePool = selectedProfiles.some((profileName) =>
    ['vault-usdc-lifecycle', 'sepolia-send-swap-redeem'].includes(profileName)
  );

  if (needsReviewerMutinynet) {
    checks.push(await checkMutinynetReviewerFunding(process.env));
  }

  if (needsSepoliaWallet) {
    const sendAmount = numericEnv(
      'DUCAT_LIVE_SEPOLIA_SEND_AMOUNT',
      Number(DEFAULT_SEPOLIA_SEND_AMOUNT)
    );
    const swapAmount = numericEnv(
      'DUCAT_LIVE_SEPOLIA_SWAP_AMOUNT',
      Number(DEFAULT_SEPOLIA_SWAP_AMOUNT)
    );
    const redeemAmount = numericEnv(
      'DUCAT_LIVE_SEPOLIA_REDEEM_AMOUNT',
      Number(DEFAULT_SEPOLIA_REDEEM_AMOUNT)
    );
    checks.push(
      await checkSepoliaReviewerFunding(process.env, {
        minUsdc: String(sendAmount + swapAmount + redeemAmount),
      })
    );
  }

  if (needsBridgePool) {
    checks.push(await checkBridgePoolLiquidity(process.env));
  }

  if (needsLiquidationAvailability) {
    checks.push(await checkLiquidationAvailability(process.env));
  }

  report.fixtureVerification.checks = checks;
  const failures = checks.filter((check) => !check.passed);
  if (failures.length > 0) {
    throw new Error(
      `Live fixture verification failed: ${failures.map((check) => check.error).join('; ')}`
    );
  }
}

function operationFromLine(line, match) {
  if (match?.[1]) return match[1];
  const bracketed = line.match(/\[([^\]]+)\]/);
  return bracketed?.[1] || 'app';
}

function phaseKey(phase, operation) {
  return `${operation}:${phase.name}`;
}

function recordPhaseEvent(type, phase, operation, line, extra = {}) {
  report.phaseEvents.push({
    type,
    phase: phase.name,
    operation,
    at: new Date().toISOString(),
    line,
    ...extra,
  });
}

function parseKeyValueFields(line) {
  const fields = {};
  const pattern = /\b([A-Za-z][A-Za-z0-9_]*)=([^{}\s,]+)/g;
  let match;
  while ((match = pattern.exec(line))) {
    fields[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return fields;
}

function rememberChainTxid(txid, event) {
  const normalized = txid.toLowerCase();
  if (!TXID_HEX_PATTERN.test(normalized)) return;

  if (!report.chainTxids[normalized]) {
    report.chainTxids[normalized] = {
      txid: normalized,
      firstSeenAt: new Date().toISOString(),
      events: [],
    };
  }

  if (!report.chainTxids[normalized].events.includes(event)) {
    report.chainTxids[normalized].events.push(event);
  }
}

function rememberEvmTxHash(txHash, event) {
  const normalized = txHash.toLowerCase();
  if (!EVM_TX_HASH_PATTERN.test(normalized)) return;

  if (!report.evmTxHashes[normalized]) {
    report.evmTxHashes[normalized] = {
      txHash: normalized,
      firstSeenAt: new Date().toISOString(),
      events: [],
    };
  }

  if (!report.evmTxHashes[normalized].events.includes(event)) {
    report.evmTxHashes[normalized].events.push(event);
  }
}

function recordE2EEvent(line) {
  const eventMatch = line.match(/\[E2E_TX\]\s+([A-Za-z0-9_:-]+)/);
  if (!eventMatch) return;

  const event = eventMatch[1];
  const fields = parseKeyValueFields(line);
  const txids = Object.entries(fields)
    .filter(([key, value]) => key.toLowerCase().endsWith('txid') && TXID_HEX_PATTERN.test(value))
    .map(([, value]) => value.toLowerCase());
  const evmTxHashes = Object.entries(fields)
    .filter(([key, value]) => {
      const normalizedKey = key.toLowerCase();
      return (
        (normalizedKey.endsWith('txhash') || normalizedKey.endsWith('evmtxhash')) &&
        EVM_TX_HASH_PATTERN.test(value)
      );
    })
    .map(([, value]) => value.toLowerCase());

  for (const txid of txids) {
    rememberChainTxid(txid, event);
  }
  for (const txHash of evmTxHashes) {
    rememberEvmTxHash(txHash, event);
  }

  report.e2eEvents.push({
    event,
    at: new Date().toISOString(),
    fields,
    txids,
    evmTxHashes,
    line: line.length > 500 ? `${line.slice(0, 500)}...[truncated]` : line,
  });
}

function clearMatchingPhases(line) {
  for (const [key, entry] of [...activePhases.entries()]) {
    if (!entry.phase.clear.some((pattern) => pattern.test(line))) continue;
    activePhases.delete(key);
    recordPhaseEvent('clear', entry.phase, entry.operation, line, {
      durationMs: Date.now() - entry.startedAtMs,
    });
  }
}

function startMatchingPhases(line) {
  for (const phase of WATCH_PHASES) {
    const match = line.match(phase.start);
    if (!match) continue;

    const operation = operationFromLine(line, match);
    const key = phaseKey(phase, operation);
    const now = Date.now();
    activePhases.set(key, {
      phase,
      operation,
      startedAtMs: now,
      startedAt: new Date(now).toISOString(),
      deadlineMs: now + phase.timeoutMs,
      lastLine: line,
    });
    watchedPhaseStartCount += 1;
    recordPhaseEvent('start', phase, operation, line);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTxStatus(txid) {
  const response = await fetch(`${report.chainVerification.esploraApiUrl}/tx/${txid}/status`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Esplora status ${response.status}`);
  }
  return response.json();
}

function readSimulatorPasteboard() {
  const simulator = report.receiveAddressVerification.simulator || 'booted';
  const result = spawnSync('xcrun', ['simctl', 'pbpaste', simulator], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
    killSignal: 'SIGKILL',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: SIMCTL_COMMAND_TIMEOUT_MS,
  });

  if (result.error) {
    if (result.error.code === 'ETIMEDOUT') {
      throw new Error(`simctl pbpaste timed out after ${SIMCTL_COMMAND_TIMEOUT_MS}ms`);
    }
    throw result.error;
  }
  if ((result.status ?? 1) !== 0) {
    throw new Error(result.stderr?.trim() || `simctl pbpaste failed with ${result.status ?? 1}`);
  }

  return result.stdout.trim();
}

function getSimulatorAppDataContainer() {
  const simulator = report.simulatorPendingTransactionVerification.simulator || 'booted';
  const result = spawnSync(
    'xcrun',
    ['simctl', 'get_app_container', simulator, 'com.ducatprotocol.DucatProtocolWallet', 'data'],
    {
      cwd: process.cwd(),
      env: process.env,
      encoding: 'utf8',
      killSignal: 'SIGKILL',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: SIMCTL_COMMAND_TIMEOUT_MS,
    }
  );

  if (result.error) {
    if (result.error.code === 'ETIMEDOUT') {
      throw new Error(`simctl get_app_container timed out after ${SIMCTL_COMMAND_TIMEOUT_MS}ms`);
    }
    throw result.error;
  }
  if ((result.status ?? 1) !== 0) {
    throw new Error(
      result.stderr?.trim() || `simctl get_app_container failed with ${result.status ?? 1}`
    );
  }

  return result.stdout.trim();
}

function collectTxidsFromPendingTransactionEntries() {
  if (!report.simulatorPendingTransactionVerification.enabled) return;

  try {
    const dataContainer = getSimulatorAppDataContainer();
    const storageDir = join(
      dataContainer,
      'Library',
      'Application Support',
      'com.ducatprotocol.DucatProtocolWallet',
      'RCTAsyncLocalStorage_V1'
    );
    const txids = new Set();

    for (const filename of readdirSync(storageDir)) {
      const filePath = join(storageDir, filename);
      const text = readFileSync(filePath, 'utf8');
      if (!text.includes('"entries"') || !text.includes('"txids"')) continue;

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        continue;
      }

      const entries = parsed?.state?.entries;
      if (!Array.isArray(entries)) continue;

      for (const entry of entries) {
        const event = `simulator_pending_store:${entry.kind || 'unknown'}:${entry.stage || 'unknown'}`;
        const entryTxids = Array.isArray(entry.txids) ? entry.txids : [entry.txid];
        for (const txid of entryTxids) {
          if (typeof txid !== 'string' || !TXID_HEX_PATTERN.test(txid)) continue;
          const normalized = txid.toLowerCase();
          txids.add(normalized);
          rememberChainTxid(normalized, event);
        }
      }
    }

    report.simulatorPendingTransactionVerification.txids = [...txids];
  } catch (error) {
    report.simulatorPendingTransactionVerification.error =
      error instanceof Error ? error.message : String(error);
  }
}

async function collectReceiveAddressTxids() {
  if (!report.receiveAddressVerification.enabled) return;
  if (Object.keys(report.chainTxids).length > 0) return;

  try {
    const address = readSimulatorPasteboard();
    report.receiveAddressVerification.address = address;

    if (!/^tb1[ac-hj-np-z02-9]+$/i.test(address)) {
      throw new Error('Simulator pasteboard does not contain a Mutinynet BTC receive address.');
    }

    const response = await fetch(
      `${report.chainVerification.esploraApiUrl}/address/${address}/txs`
    );
    if (!response.ok) {
      throw new Error(`Esplora address tx lookup returned ${response.status}`);
    }

    const txs = await response.json();
    if (!Array.isArray(txs) || txs.length === 0) {
      throw new Error('No on-chain transactions were found for the copied receive address.');
    }

    const txids = txs
      .map((tx) => tx?.txid)
      .filter((txid) => typeof txid === 'string' && TXID_HEX_PATTERN.test(txid));

    if (txids.length === 0) {
      throw new Error('Receive address transactions did not include valid txids.');
    }

    report.receiveAddressVerification.txids = txids;
    for (const txid of txids) {
      rememberChainTxid(txid, 'receive_address_seen');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.receiveAddressVerification.error = message;
    failRun(`Receive address chain verification setup failed: ${message}`);
  }
}

function collectClipboardTxid() {
  if (!report.clipboardTxidVerification.enabled) return;
  if (Object.keys(report.chainTxids).length > 0) return;

  try {
    const value = readSimulatorPasteboard().trim();
    if (!TXID_HEX_PATTERN.test(value)) return;

    report.clipboardTxidVerification.txid = value.toLowerCase();
    rememberChainTxid(value, 'clipboard_txid');
  } catch (error) {
    report.clipboardTxidVerification.error = error instanceof Error ? error.message : String(error);
  }
}

function requiresConfirmationForChainTxid(txid) {
  if (!requireConfirmation) return false;
  const events = report.chainTxids[txid]?.events ?? [];
  return !events.some(
    (event) => event.startsWith('simulator_pending_store:') && event.endsWith(':recoverable')
  );
}

async function waitForTxStatus(txid, requireTxConfirmation = requireConfirmation) {
  const timeoutMs = Number(
    process.env.DUCAT_LIVE_CHAIN_TIMEOUT_MS ||
      (requireTxConfirmation ? DEFAULT_CONFIRMATION_TIMEOUT_MS : DEFAULT_MEMPOOL_TIMEOUT_MS)
  );
  const pollMs = Number(process.env.DUCAT_LIVE_CHAIN_POLL_MS || DEFAULT_CONFIRMATION_POLL_MS);
  const startedAt = Date.now();
  let lastStatus = null;
  let lastError = null;

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const status = await fetchTxStatus(txid);
      if (status) {
        lastStatus = status;
        if (!requireTxConfirmation || status.confirmed) {
          return {
            txid,
            passed: true,
            confirmed: Boolean(status.confirmed),
            confirmationRequired: requireTxConfirmation,
            status,
            durationMs: Date.now() - startedAt,
            error: null,
          };
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await wait(pollMs);
  }

  return {
    txid,
    passed: false,
    confirmed: Boolean(lastStatus?.confirmed),
    confirmationRequired: requireTxConfirmation,
    status: lastStatus,
    durationMs: Date.now() - startedAt,
    error:
      lastError ||
      (lastStatus
        ? requireTxConfirmation
          ? 'Transaction reached mempool but did not confirm before timeout.'
          : 'Transaction did not satisfy chain visibility requirements before timeout.'
        : 'Transaction was not found by Esplora before timeout.'),
  };
}

async function fetchEvmReceipt(txHash) {
  if (!sepoliaRpcUrl) {
    throw new Error('No Sepolia JSON-RPC URL configured.');
  }

  const response = await fetch(sepoliaRpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    }),
  });

  if (!response.ok) {
    throw new Error(`Sepolia RPC status ${response.status}`);
  }

  const body = await response.json();
  if (body?.error) {
    throw new Error(body.error.message || JSON.stringify(body.error));
  }

  return body?.result ?? null;
}

async function waitForEvmReceipt(txHash) {
  const timeoutMs = Number(process.env.DUCAT_LIVE_EVM_TIMEOUT_MS || DEFAULT_EVM_TIMEOUT_MS);
  const pollMs = Number(process.env.DUCAT_LIVE_EVM_POLL_MS || DEFAULT_EVM_POLL_MS);
  const startedAt = Date.now();
  let lastReceipt = null;
  let lastError = null;

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const receipt = await fetchEvmReceipt(txHash);
      if (receipt) {
        lastReceipt = receipt;
        const status = String(receipt.status || '').toLowerCase();
        const mined = Boolean(receipt.blockNumber);
        if (status === '0x0') {
          return {
            txHash,
            passed: false,
            mined,
            receipt,
            durationMs: Date.now() - startedAt,
            error: 'Sepolia transaction receipt failed with status 0x0.',
          };
        }
        if (status === '0x1' && (!requireConfirmation || mined)) {
          return {
            txHash,
            passed: true,
            mined,
            receipt,
            durationMs: Date.now() - startedAt,
            error: null,
          };
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await wait(pollMs);
  }

  return {
    txHash,
    passed: false,
    mined: Boolean(lastReceipt?.blockNumber),
    receipt: lastReceipt,
    durationMs: Date.now() - startedAt,
    error:
      lastError ||
      (lastReceipt
        ? 'Sepolia transaction was found but did not satisfy confirmation requirements before timeout.'
        : 'Sepolia transaction receipt was not found before timeout.'),
  };
}

async function verifyEmittedChainTxids() {
  if (!verifyChain) return;

  await collectReceiveAddressTxids();
  collectClipboardTxid();
  collectTxidsFromPendingTransactionEntries();

  const txids = Object.keys(report.chainTxids);
  if (txids.length === 0) {
    if (!selectedProfilesExpectChainTxids) return;
    if (process.env.DUCAT_LIVE_REQUIRE_TX_TRACE === 'false') return;
    failRun(
      'No [E2E_TX] on-chain txids were emitted. The live suite did not prove real transaction execution.'
    );
    return;
  }

  for (const txid of txids) {
    const requireTxConfirmation = requiresConfirmationForChainTxid(txid);
    const result = await waitForTxStatus(txid, requireTxConfirmation);
    report.chainVerification.results.push({
      ...result,
      events: report.chainTxids[txid]?.events ?? [],
    });
    if (!result.passed) {
      failRun(`Chain verification failed for ${txid}: ${result.error}`);
      return;
    }
  }
}

async function verifyEmittedEvmTxHashes() {
  if (!verifyChain) return;

  const txHashes = Object.keys(report.evmTxHashes);
  if (txHashes.length === 0) {
    if (selectedProfilesExpectEvmTxHashes && process.env.DUCAT_LIVE_REQUIRE_TX_TRACE !== 'false') {
      failRun(
        'No [E2E_TX] Sepolia tx hashes were emitted. The Sepolia suite did not prove real EVM execution.'
      );
    }
    return;
  }

  if (!sepoliaRpcUrl) {
    failRun(
      'Sepolia tx hashes were emitted, but DUCAT_LIVE_SEPOLIA_RPC_URL or EXPO_PUBLIC_SEPOLIA_RPC_URL is not configured.'
    );
    return;
  }

  for (const txHash of txHashes) {
    const result = await waitForEvmReceipt(txHash);
    report.evmVerification.results.push({
      ...result,
      events: report.evmTxHashes[txHash]?.events ?? [],
    });
    if (!result.passed) {
      failRun(`Sepolia verification failed for ${txHash}: ${result.error}`);
      return;
    }
  }
}

function verifyRequiredEvents() {
  const requiredEvents = [
    ...new Set(
      selectedProfiles.flatMap((profileName) => PROFILES[profileName].requiredEvents ?? [])
    ),
  ];
  if (requiredEvents.length === 0) return;

  const seen = new Set(report.e2eEvents.map((event) => event.event));
  const missing = requiredEvents.filter((event) => !seen.has(event));
  if (missing.length === 0) return;

  failRun(`Missing required live app event(s): ${missing.join(', ')}`);
}

function failRun(message) {
  if (failed) return;
  failed = true;
  report.result = 'failed';
  report.error = message;
  console.error(`Live regression failed: ${message}`);

  if (!child || child.killed) return;
  signalChild('SIGTERM');
  setTimeout(() => {
    if (child && !child.killed) signalChild('SIGKILL');
  }, 2500).unref();
}

function signalChild(signal) {
  if (!child?.pid) return;

  try {
    if (process.platform !== 'win32') {
      process.kill(-child.pid, signal);
    } else {
      child.kill(signal);
    }
  } catch {
    child.kill(signal);
  }
}

function checkWatchdog() {
  const now = Date.now();
  for (const entry of activePhases.values()) {
    if (now <= entry.deadlineMs) continue;
    failRun(
      `${entry.operation} ${entry.phase.name} exceeded ${entry.phase.timeoutMs}ms. Last line: ${entry.lastLine}`
    );
    return;
  }
}

function handleOutput(chunk, streamName) {
  const text = chunk.toString('utf8');
  process[streamName].write(text);

  const bufferName = streamName === 'stdout' ? 'stdoutBuffer' : 'stderrBuffer';
  const combined = (bufferName === 'stdoutBuffer' ? stdoutBuffer : stderrBuffer) + text;
  const lines = combined.split(/\r?\n/);
  const remainder = lines.pop() || '';

  if (bufferName === 'stdoutBuffer') {
    stdoutBuffer = remainder;
  } else {
    stderrBuffer = remainder;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    recordE2EEvent(line);
    clearMatchingPhases(line);
    startMatchingPhases(line);
  }
}

function runDoctor() {
  if (options.has('--skip-doctor') || process.env.DUCAT_LIVE_REGRESSION_SKIP_DOCTOR === '1') {
    console.warn('Skipping live integration doctor for this regression run.');
    return;
  }

  const result = spawnSync(process.execPath, ['scripts/liveIntegrationDoctor.mjs'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) {
    throw new Error('liveIntegrationDoctor failed; refusing to run live regression flows.');
  }
}

function requireLogCoverage(exitCode) {
  if (process.env.DUCAT_LIVE_REGRESSION_REQUIRE_LOGS === 'false') return;
  if (selectedFlows.length === 0) return;
  if (selectedProfiles.length === 1 && selectedProfiles[0] === 'receive-btc') return;
  collectClipboardTxid();
  collectTxidsFromPendingTransactionEntries();
  if (Object.keys(report.chainTxids).length > 0) return;
  if ((exitCode ?? 1) !== 0 || watchedPhaseStartCount > 0 || report.e2eEvents.length > 0) return;
  failRun(
    'No watched app transaction phases or [E2E_TX] events were seen in Metro output. Start Metro through this runner or set DUCAT_LIVE_REGRESSION_REQUIRE_LOGS=false.'
  );
}

async function finishRun(code, signal) {
  if (watchdogTimer) clearInterval(watchdogTimer);
  requireLogCoverage(code);

  if (!failed && (code ?? 1) !== 0) {
    report.result = 'failed';
    report.error = `runMaestroLive exited with ${signal || code}`;
  }

  if (!failed && report.result !== 'failed') {
    await verifyEmittedChainTxids();
  }

  if (!failed && report.result !== 'failed') {
    await verifyEmittedEvmTxHashes();
  }

  if (!failed && report.result !== 'failed') {
    verifyRequiredEvents();
  }

  if (!failed && report.result !== 'failed') {
    report.result = 'passed';
  }

  writeReport();
  process.exit(report.result === 'passed' ? 0 : 1);
}

try {
  validateProfileRequirements();
  runDoctor();
  await validateLiveFixtureFunding();

  console.log(`Running live regression profiles: ${selectedProfiles.join(', ')}`);
  console.log(`Flows: ${selectedFlows.join(', ')}`);
  if (selectedFlows.length === 0) {
    console.log('No Maestro flows selected; fixture checks completed.');
    await finishRun(0, null);
  }
  if (verifyChain) {
    console.log(
      `Chain verification: ${requireConfirmation ? 'requires confirmation' : 'requires mempool visibility'} via ${report.chainVerification.esploraApiUrl}`
    );
  }

  child = spawn(process.execPath, ['scripts/runMaestroLive.mjs', ...selectedFlows], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DUCAT_LIVE_REGRESSION: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });

  watchdogTimer = setInterval(checkWatchdog, 1000);
  child.stdout?.on('data', (chunk) => handleOutput(chunk, 'stdout'));
  child.stderr?.on('data', (chunk) => handleOutput(chunk, 'stderr'));
  child.on('error', (error) => failRun(error.message));
  child.on('exit', (code, signal) => {
    finishRun(code, signal).catch((error) => {
      failRun(error instanceof Error ? error.message : String(error));
      writeReport();
      process.exit(1);
    });
  });
} catch (error) {
  report.result = 'failed';
  report.error = error instanceof Error ? error.message : String(error);
  console.error(report.error);
  writeReport();
  process.exit(1);
}
