#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { dirname, resolve } from 'node:path';
import { loadProjectEnvironment } from './loadEnv.mjs';

loadProjectEnvironment();

const APP_ID = 'com.ducatprotocol.DucatProtocolWallet';
const DEFAULT_FLOWS = ['e2e/maestro/flows/test/'];
const DEFAULT_EXPO_PORT = 8082;
const DEFAULT_REPORT_PATH = 'artifacts/live-maestro/last-run.json';
const MAESTRO_FORWARD_ENV_KEYS = [
  'DUCAT_LIVE_CASHU_TOKEN_URL',
  'DUCAT_LIVE_TURBOUNIT_TOKEN_URL',
  'DUCAT_LIVE_LIQUIDATION_INVEST_BTC',
  'DUCAT_LIVE_SEPOLIA_RECIPIENT',
  'DUCAT_LIVE_SEPOLIA_SEND_AMOUNT',
  'DUCAT_LIVE_SEPOLIA_SWAP_AMOUNT',
  'DUCAT_LIVE_SEPOLIA_REDEEM_AMOUNT',
];
const explicitPort =
  process.env.MAESTRO_LIVE_EXPO_PORT ||
  process.env.MAESTRO_EXPO_PORT ||
  process.env.EXPO_DEV_SERVER_PORT;
const candidatePorts = [explicitPort ? Number(explicitPort) : DEFAULT_EXPO_PORT].filter(
  (port) => Number.isInteger(port) && port > 0
);

let metroProcess = null;
let metroStartedByScript = false;

const liveReport = {
  schemaVersion: 1,
  kind: 'ducat.live-maestro',
  appId: APP_ID,
  startedAt: new Date().toISOString(),
  finishedAt: null,
  durationMs: null,
  result: 'running',
  cashuMintUrl: readCashuMintUrl(),
  flows: [],
  environment: {
    easProfile: process.env.DUCAT_EAS_PROFILE || process.env.EAS_BUILD_PROFILE || 'production',
    expoPublicEnv: process.env.EXPO_PUBLIC_ENV || null,
    appNetwork: process.env.EXPO_PUBLIC_APP_NETWORK || null,
  },
  metro: {
    startedByScript: false,
    port: null,
    reusedExisting: false,
  },
  error: null,
};
const liveReportStartedAt = Date.now();

function maestroEnvArgs(extra = {}) {
  const entries = {
    ...Object.fromEntries(
      MAESTRO_FORWARD_ENV_KEYS.filter((key) => process.env[key]).map((key) => [
        key,
        process.env[key],
      ])
    ),
    ...extra,
  };

  return Object.entries(entries).flatMap(([key, value]) => ['-e', `${key}=${value}`]);
}

function readCashuMintUrl() {
  try {
    const source = readFileSync('services/cashu/mintClient/mintConfig.ts', 'utf8');
    return source.match(/export\s+const\s+MINT_URL\s*=\s*['"]([^'"]+)['"]/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function writeLiveReport() {
  const reportPath = process.env.MAESTRO_LIVE_REPORT_PATH || DEFAULT_REPORT_PATH;
  if (reportPath === 'off' || reportPath === 'false') {
    return;
  }

  liveReport.finishedAt = new Date().toISOString();
  liveReport.durationMs = Date.now() - liveReportStartedAt;

  const absolutePath = resolve(process.cwd(), reportPath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(`${absolutePath}.tmp`, `${JSON.stringify(liveReport, null, 2)}\n`);
  renameSync(`${absolutePath}.tmp`, absolutePath);
  console.log(`Live Maestro report written to ${reportPath}`);
}

function liveEnvironment(extra = {}) {
  return {
    ...process.env,
    EXPO_NO_TELEMETRY: '1',
    EXPO_PUBLIC_DUCAT_LIVE_REGRESSION: 'true',
    EXPO_PUBLIC_VERBOSE_DEBUG_LOGS: 'true',
    ...extra,
  };
}

function statusForPort(port) {
  return new Promise((resolve) => {
    const request = http.get(
      {
        host: '127.0.0.1',
        port,
        path: '/status',
        timeout: 1500,
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          resolve(response.statusCode === 200 && body.includes('packager-status:running'));
        });
      }
    );

    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
    request.on('error', () => resolve(false));
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForMetro(port, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await statusForPort(port)) return true;
    await wait(1000);
  }
  return false;
}

async function ensureLiveMetro(port) {
  if (await statusForPort(port)) {
    liveReport.metro.port = port;
    if (process.env.MAESTRO_LIVE_REUSE_METRO === 'true') {
      console.warn(`Reusing existing Metro on port ${port}; ensure it was started for live E2E.`);
      liveReport.metro.reusedExisting = true;
      return true;
    }

    throw new Error(
      `Metro is already running on live port ${port}. Stop it, choose MAESTRO_LIVE_EXPO_PORT, ` +
        'or set MAESTRO_LIVE_REUSE_METRO=true only after verifying that Metro points at this app.'
    );
  }

  if (process.env.MAESTRO_EXPO_AUTOSTART === 'false') {
    return false;
  }

  console.log(`Starting live Expo Metro for this project on port ${port}...`);
  metroStartedByScript = true;
  liveReport.metro.startedByScript = true;
  liveReport.metro.port = port;
  metroProcess = spawn(
    process.execPath,
    [
      'scripts/run-node22.mjs',
      'expo',
      'start',
      '--port',
      String(port),
      '--host',
      'localhost',
      '--clear',
    ],
    {
      cwd: process.cwd(),
      env: liveEnvironment({ CI: '1' }),
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    }
  );

  metroProcess.stdout?.on('data', (chunk) => process.stderr.write(`[live metro] ${chunk}`));
  metroProcess.stderr?.on('data', (chunk) => process.stderr.write(`[live metro] ${chunk}`));

  return waitForMetro(port, 90_000);
}

async function resolveDevClientUrl() {
  if (process.env.MAESTRO_EXPO_DEV_CLIENT_URL) {
    return process.env.MAESTRO_EXPO_DEV_CLIENT_URL;
  }

  for (const port of candidatePorts) {
    if (await ensureLiveMetro(port)) {
      const metroUrl = `http://localhost:${port}`;
      return `${APP_ID}://expo-development-client/?url=${encodeURIComponent(metroUrl)}`;
    }
  }

  throw new Error(
    `No live Expo Metro server was found on ports ${candidatePorts.join(', ')}. ` +
      'Start Expo first, or allow this script to autostart it.'
  );
}

function stopMetroIfStarted() {
  if (!metroProcess || metroProcess.killed) return;

  const signalMetro = (signal) => {
    try {
      if (process.platform !== 'win32' && metroProcess.pid) {
        process.kill(-metroProcess.pid, signal);
      } else {
        metroProcess.kill(signal);
      }
    } catch {
      metroProcess.kill(signal);
    }
  };

  signalMetro('SIGTERM');

  const waitBuffer = new SharedArrayBuffer(4);
  const waitView = new Int32Array(waitBuffer);
  Atomics.wait(waitView, 0, 0, 750);

  try {
    if (metroProcess.pid) {
      process.kill(metroProcess.pid, 0);
      signalMetro('SIGKILL');
    }
  } catch {
    // Already exited.
  }
}

const flows = process.argv.slice(2);
if (flows.includes('-h') || flows.includes('--help')) {
  console.log(`Usage: node scripts/runMaestroLive.mjs [flow ...]

Runs live Maestro flows against the normal dev-client app bundle.
Defaults to e2e/maestro/flows/test/. Override with:
  MAESTRO_LIVE_EXPO_PORT=<port>
  MAESTRO_EXPO_DEV_CLIENT_URL=<url>
  MAESTRO_LIVE_REUSE_METRO=true
  MAESTRO_LIVE_REPORT_PATH=<path|off>

Forwarded to Maestro when present:
  ${MAESTRO_FORWARD_ENV_KEYS.join('\n  ')}`);
  process.exit(0);
}

const targetFlows = flows.length > 0 ? flows : DEFAULT_FLOWS;

try {
  const devClientUrl = await resolveDevClientUrl();
  let failed = 0;

  for (const flow of targetFlows) {
    console.log(`\nRunning live Maestro flow: ${flow}`);
    const flowStartedAt = Date.now();
    const result = spawnSync(
      'maestro',
      ['test', ...maestroEnvArgs({ MAESTRO_EXPO_DEV_CLIENT_URL: devClientUrl }), flow],
      {
        cwd: process.cwd(),
        env: liveEnvironment({ MAESTRO_EXPO_DEV_CLIENT_URL: devClientUrl }),
        stdio: 'inherit',
      }
    );

    if (result.error) {
      throw result.error;
    }

    if ((result.status ?? 1) !== 0) {
      failed += 1;
    }

    liveReport.flows.push({
      flow,
      status: result.status ?? 1,
      signal: result.signal ?? null,
      durationMs: Date.now() - flowStartedAt,
      passed: (result.status ?? 1) === 0,
    });
  }

  stopMetroIfStarted();
  liveReport.result = failed > 0 ? 'failed' : 'passed';
  liveReport.metro.startedByScript = metroStartedByScript;
  writeLiveReport();
  process.exit(failed > 0 ? 1 : 0);
} catch (error) {
  stopMetroIfStarted();
  const message = error instanceof Error ? error.message : String(error);
  liveReport.result = 'failed';
  liveReport.error = message;
  writeLiveReport();
  console.error(message);
  process.exit(1);
}
