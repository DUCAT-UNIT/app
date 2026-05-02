#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const APP_ID = 'com.ducatprotocol.DucatProtocolWallet';

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function run(command, commandArgs) {
  return spawnSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function printChecklist() {
  console.log(`Cold install audit checklist for ${APP_ID}`);
  console.log('');
  console.log('1. Boot an iPhone simulator and install the native app, not Expo Go.');
  console.log('2. Start from no SecureStore/AsyncStorage data. Use --reset-app to uninstall from the booted simulator.');
  console.log('3. Create a wallet and verify onboarding, PIN/passkey, and first wallet load complete without blank screens.');
  console.log('4. Confirm Mutinynet-only copy and tb1/tb1p addresses; no remote config or mainnet network picker should appear.');
  console.log('5. Verify USDC/Sepolia ETH cards are hidden until Advanced > Developer mode > Enable USDC succeeds.');
  console.log('6. Send BTC/UNIT paths must stop on review before auth/submit.');
  console.log('7. Vault open/borrow/repay/deposit/withdraw must show review, busy state, pending state, and clear forms after completion/back.');
  console.log('8. Kill and relaunch during a pending send/vault/EVM checkpoint; the operation journal should preserve recovery context.');
  console.log('9. Disable network and reload liquidation/vault screens; last good data should remain with a stale/error banner.');
  console.log('10. Re-enable network and confirm background refresh clears stale state without requiring repeated taps.');
}

function checkProjectShape() {
  const failures = [];
  const appConfig = read('app.config.ts');
  const appJson = JSON.parse(read('app.json'));

  if (!appConfig.includes('Mutinynet-only') || !appConfig.includes('EXPO_PUBLIC_APP_NETWORK')) {
    failures.push('app.config.ts must enforce Mutinynet-only startup.');
  }

  if (appJson.expo?.ios?.bundleIdentifier !== APP_ID) {
    failures.push(`iOS bundleIdentifier must be ${APP_ID}.`);
  }

  if (!existsSync(join(root, 'stores', 'operationJournalStore.ts'))) {
    failures.push('operation journal store is missing.');
  }

  return failures;
}

function inspectSimulator() {
  const result = run('xcrun', ['simctl', 'list', 'devices', 'booted']);
  if (result.status !== 0) {
    console.warn('warning: xcrun simulator inspection failed; install Xcode command line tools or boot a simulator.');
    return;
  }

  const output = `${result.stdout}${result.stderr}`.trim();
  console.log(output || 'No booted simulator found.');
}

function resetBootedSimulatorApp() {
  const result = run('xcrun', ['simctl', 'uninstall', 'booted', APP_ID]);
  if (result.status === 0) {
    console.log(`Uninstalled ${APP_ID} from the booted simulator.`);
    return;
  }

  const output = `${result.stdout}${result.stderr}`.trim();
  if (/No such app|No devices are booted|not installed/i.test(output)) {
    console.log(`No installed ${APP_ID} app was found on the booted simulator.`);
    return;
  }

  console.error(output || `Failed to uninstall ${APP_ID}`);
  process.exitCode = 1;
}

const failures = checkProjectShape();
if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`cold install audit failed: ${failure}`);
  }
  process.exitCode = 1;
}

printChecklist();

if (args.has('--inspect-simulator')) {
  console.log('');
  inspectSimulator();
}

if (args.has('--reset-app')) {
  console.log('');
  resetBootedSimulatorApp();
}
