#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadProjectEnvironment } from './loadEnv.mjs';

loadProjectEnvironment();

const DEFAULT_PORT = 3201;
const DEFAULT_PROFILE = 'real';
const DEFAULT_REPORT_PATH = 'artifacts/serve-sim-regression/last-run.json';

const rawArgs = process.argv.slice(2);
const profileArgs = [];
const options = {
  build: false,
  dryRun: false,
  killAfter: false,
  noRun: false,
  port: DEFAULT_PORT,
  device: process.env.SERVE_SIM_DEVICE || process.env.MAESTRO_DEVICE || 'booted',
};

for (let i = 0; i < rawArgs.length; i += 1) {
  const arg = rawArgs[i];

  if (arg === '--help' || arg === '-h') {
    console.log(`Usage: node scripts/runServeSimRegression.mjs [profile ...] [options]

Starts serve-sim for a booted iOS simulator, optionally installs the dev client,
then runs scripts/runUserFacingRegression.mjs.

Profiles default to "${DEFAULT_PROFILE}" and match e2e/user-facing-regression.json.

Options:
  --device <name|udid|booted>  Simulator target for serve-sim and optional build.
  --port <port>                serve-sim preview port. Default: ${DEFAULT_PORT}.
  --build                      Rebuild/install the dev client before running tests.
  --no-run                     Start serve-sim and write a report without running tests.
  --dry-run                    Print the selected command without running tests.
  --kill-after                 Stop serve-sim after the run.

Report: ${DEFAULT_REPORT_PATH}`);
    process.exit(0);
  }

  if (arg === '--build') {
    options.build = true;
    continue;
  }

  if (arg === '--dry-run') {
    options.dryRun = true;
    continue;
  }

  if (arg === '--kill-after') {
    options.killAfter = true;
    continue;
  }

  if (arg === '--no-run') {
    options.noRun = true;
    continue;
  }

  if (arg === '--device') {
    options.device = rawArgs[i + 1];
    i += 1;
    continue;
  }

  if (arg.startsWith('--device=')) {
    options.device = arg.slice('--device='.length);
    continue;
  }

  if (arg === '--port') {
    options.port = Number(rawArgs[i + 1]);
    i += 1;
    continue;
  }

  if (arg.startsWith('--port=')) {
    options.port = Number(arg.slice('--port='.length));
    continue;
  }

  profileArgs.push(arg);
}

if (!Number.isInteger(options.port) || options.port <= 0) {
  console.error(`Invalid --port value: ${options.port}`);
  process.exit(1);
}

if (!options.device) {
  console.error('Missing simulator device. Pass --device <name|udid|booted>.');
  process.exit(1);
}

const selectedProfiles = profileArgs.length > 0 ? profileArgs : [DEFAULT_PROFILE];
const startedAtMs = Date.now();
const report = {
  schemaVersion: 1,
  kind: 'ducat.serve-sim-regression',
  startedAt: new Date(startedAtMs).toISOString(),
  finishedAt: null,
  durationMs: null,
  result: 'running',
  profiles: selectedProfiles,
  options,
  serveSim: null,
  build: null,
  regression: null,
  screenshots: [],
  error: null,
};

function writeReport() {
  const reportPath = process.env.DUCAT_SERVE_SIM_REGRESSION_REPORT_PATH || DEFAULT_REPORT_PATH;
  if (reportPath === 'off' || reportPath === 'false') return;

  report.finishedAt = new Date().toISOString();
  report.durationMs = Date.now() - startedAtMs;

  const absolutePath = resolve(process.cwd(), reportPath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(`${absolutePath}.tmp`, `${JSON.stringify(report, null, 2)}\n`);
  renameSync(`${absolutePath}.tmp`, absolutePath);
  console.log(`serve-sim regression report written to ${reportPath}`);
}

function run(command, args, { env = {}, stdio = 'inherit' } = {}) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      EXPO_NO_TELEMETRY: '1',
      ...env,
    },
    encoding: stdio === 'pipe' ? 'utf8' : undefined,
    stdio,
  });
}

function failIfError(label, result) {
  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 1}`);
  }
}

function parseJsonOutput(label, result) {
  failIfError(label, result);
  const output = `${result.stdout || ''}`.trim();
  const jsonLine = output
    .split('\n')
    .reverse()
    .find((line) => line.trim().startsWith('{'));

  if (!jsonLine) {
    throw new Error(`${label} did not return JSON output.`);
  }

  return JSON.parse(jsonLine);
}

function startServeSim() {
  console.log(`Starting serve-sim for ${options.device} on port ${options.port}...`);
  const result = run('npx', ['serve-sim', '-p', String(options.port), '--detach', options.device], {
    stdio: 'pipe',
  });
  const stream = parseJsonOutput('serve-sim', result);
  report.serveSim = stream;
  console.log(`serve-sim preview: ${stream.url}`);
  return stream;
}

function captureScreenshot(device, name) {
  const path = `artifacts/serve-sim-regression/${name}.png`;
  mkdirSync(dirname(resolve(process.cwd(), path)), { recursive: true });

  const result = run('xcrun', ['simctl', 'io', device, 'screenshot', path], {
    stdio: 'pipe',
  });

  if ((result.status ?? 1) !== 0 || !existsSync(resolve(process.cwd(), path))) {
    console.warn(`warning: failed to capture simulator screenshot "${name}"`);
    return null;
  }

  report.screenshots.push(path);
  return path;
}

function installDevClient() {
  console.log(`Installing dev client on ${options.device}...`);
  const startedAt = Date.now();
  const result = run('npx', ['expo', 'run:ios', '--device', options.device, '--no-bundler']);

  report.build = {
    command: ['npx', 'expo', 'run:ios', '--device', options.device, '--no-bundler'],
    status: result.status ?? null,
    signal: result.signal ?? null,
    durationMs: Date.now() - startedAt,
  };

  failIfError('dev-client install', result);
}

function runRegression() {
  const command = ['node', 'scripts/runUserFacingRegression.mjs', ...selectedProfiles];
  report.regression = {
    command,
    status: null,
    signal: null,
    durationMs: null,
  };

  console.log(`Running user-facing regression: ${command.join(' ')}`);

  if (options.dryRun) {
    report.regression.status = 0;
    report.regression.durationMs = 0;
    return 0;
  }

  const startedAt = Date.now();
  const result = run(command[0], command.slice(1), {
    env: {
      DUCAT_SERVE_SIM_URL: report.serveSim?.url || '',
      DUCAT_SERVE_SIM_STREAM_URL: report.serveSim?.streamUrl || '',
      DUCAT_SERVE_SIM_DEVICE: report.serveSim?.device || String(options.device),
    },
  });

  report.regression.status = result.status ?? null;
  report.regression.signal = result.signal ?? null;
  report.regression.durationMs = Date.now() - startedAt;

  if (result.error) throw result.error;
  return result.status ?? 1;
}

function killServeSim() {
  if (!options.killAfter) return;
  console.log('Stopping serve-sim...');
  const target = report.serveSim?.device || options.device;
  run('npx', ['serve-sim', '--kill', target], { stdio: 'pipe' });
}

let exitCode = 0;

try {
  const stream = startServeSim();
  const screenshotDevice = stream.device || 'booted';
  captureScreenshot(screenshotDevice, 'start');

  if (options.build) {
    installDevClient();
    captureScreenshot(screenshotDevice, 'after-build');
  }

  if (options.noRun) {
    report.result = 'passed';
  } else {
    exitCode = runRegression();
    captureScreenshot(screenshotDevice, exitCode === 0 ? 'passed' : 'failed');
    report.result = exitCode === 0 ? 'passed' : 'failed';
  }
} catch (error) {
  exitCode = 1;
  report.result = 'failed';
  report.error = error instanceof Error ? error.message : String(error);
  console.error(report.error);
} finally {
  killServeSim();
  writeReport();
}

process.exit(exitCode);
