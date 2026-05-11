#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const quick = args.has('--quick');
const runtimeE2E = args.has('--runtime-e2e');

const failures = [];
const EXPECTED_RELEASE_VERSION = '0.0.6';

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function fail(message) {
  failures.push(message);
}

function run(label, command, commandArgs) {
  console.log(`release doctor: ${label}`);
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    fail(`${label} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

function checkStaticReleaseInvariants() {
  const appJson = JSON.parse(read('app.json'));
  const appConfig = read('app.config.ts');
  const networkConfig = read('utils/networkConfig.ts');
  const settings = read('constants/settings.ts');

  if (appJson.expo?.version !== EXPECTED_RELEASE_VERSION) {
    fail(`app.json version is ${appJson.expo?.version}; expected ${EXPECTED_RELEASE_VERSION} for this release train.`);
  }

  if (!appJson.expo?.ios?.buildNumber) {
    fail('app.json ios.buildNumber is missing.');
  }

  if (!appConfig.includes('DUCAT mobile is Mutinynet-only')) {
    fail('app.config.ts must hard-fail non-Mutinynet app network config.');
  }

  if (!networkConfig.includes("export type AppNetworkId = 'mutinynet'")) {
    fail('utils/networkConfig.ts must keep the app network narrowed to mutinynet.');
  }

  if (!settings.includes("USDC_FEATURE_PASSWORD = 'fx-570ES PLUS'")) {
    fail('Enable USDC developer password invariant changed.');
  }

  if (!existsSync(join(root, 'stores', 'operationJournalStore.ts'))) {
    fail('operationJournalStore.ts is missing.');
  }
}

checkStaticReleaseInvariants();

const baseCommands = [
  ['doctor', 'npm', ['run', 'doctor']],
  ['cold install audit', 'npm', ['run', 'cold-install:audit']],
  ['history audit', 'npm', ['run', 'history:audit']],
  ['performance audit', 'npm', ['run', 'perf:audit']],
  ['e2e validation', 'npm', ['run', 'e2e:validate']],
];

const fullCommands = [
  ['typecheck', 'npm', ['run', 'typecheck']],
  ['lint', 'npm', ['run', 'lint', '--', '--quiet']],
  [
    'focused jest',
    'npm',
    [
      'run',
      'test',
      '--',
      '--runInBand',
      'stores/__tests__/operationJournalStore.test.ts',
      'stores/__tests__/evmTransactionCheckpointStore.test.ts',
      'utils/__tests__/evmCheckpointDisplay.test.ts',
      'utils/__tests__/requestPolicy.test.ts',
      'utils/__tests__/errorTaxonomy.test.ts',
    ],
  ],
];

for (const [label, command, commandArgs] of baseCommands) {
  run(label, command, commandArgs);
}

if (!quick) {
  for (const [label, command, commandArgs] of fullCommands) {
    run(label, command, commandArgs);
  }
}

if (runtimeE2E) {
  run('critical Maestro runtime flows', 'npm', ['run', 'e2e:critical']);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`release doctor failed: ${failure}`);
  }
  process.exit(1);
}

console.log('Release doctor passed.');
