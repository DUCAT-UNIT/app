#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { dirname, resolve } from 'node:path';

const APP_ID = 'com.ducatprotocol.DucatProtocolWallet';
const DEFAULT_FLOWS = ['e2e/maestro/flows/test/'];
const DEFAULT_EXPO_PORT = 8082;
const DEFAULT_REPORT_PATH = 'artifacts/live-maestro/last-run.json';
const explicitPort = process.env.MAESTRO_LIVE_EXPO_PORT || process.env.MAESTRO_EXPO_PORT || process.env.EXPO_DEV_SERVER_PORT;
const candidatePorts = [explicitPort ? Number(explicitPort) : DEFAULT_EXPO_PORT]
  .filter((port) => Number.isInteger(port) && port > 0);

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
  e2eBypass: 'false',
  cashuMintUrl: readCashuMintUrl(),
  flows: [],
  environmentAssertions: {
    fundedMutinynet: process.env.DUCAT_LIVE_E2E_FUNDED_MUTINYNET === '1',
    fundedSepolia: process.env.DUCAT_LIVE_E2E_FUNDED_SEPOLIA === '1',
    bridgeFunded: process.env.DUCAT_LIVE_E2E_BRIDGE_FUNDED === '1',
  },
  metro: {
    startedByScript: false,
    port: null,
    reusedExisting: false,
  },
  error: null,
};
const liveReportStartedAt = Date.now();

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
    EXPO_PUBLIC_E2E_BYPASS: 'false',
    EXPO_NO_TELEMETRY: '1',
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
      console.warn(
        `Reusing existing Metro on port ${port}; ensure it was started with EXPO_PUBLIC_E2E_BYPASS=false.`
      );
      liveReport.metro.reusedExisting = true;
      return true;
    }

    throw new Error(
      `Metro is already running on live port ${port}. Stop it, choose MAESTRO_LIVE_EXPO_PORT, ` +
      'or set MAESTRO_LIVE_REUSE_METRO=true only if that Metro was started without E2E bypass.'
    );
  }

  if (process.env.MAESTRO_EXPO_AUTOSTART === 'false') {
    return false;
  }

  console.log(`Starting live Expo Metro for this project on port ${port}...`);
  metroStartedByScript = true;
  liveReport.metro.startedByScript = true;
  liveReport.metro.port = port;
  metroProcess = spawn(process.execPath, [
    'scripts/run-node22.mjs',
    'expo',
    'start',
    '--port',
    String(port),
    '--host',
    'localhost',
    '--clear',
  ], {
    cwd: process.cwd(),
    env: liveEnvironment({ CI: '1' }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  metroProcess.stdout?.on('data', (chunk) => process.stderr.write(`[live metro] ${chunk}`));
  metroProcess.stderr?.on('data', (chunk) => process.stderr.write(`[live metro] ${chunk}`));

  return waitForMetro(port, 90_000);
}

async function resolveDevClientUrl() {
  if (process.env.MAESTRO_EXPO_DEV_CLIENT_URL) {
    if (
      process.env.EXPO_PUBLIC_E2E_BYPASS === 'true' &&
      process.env.MAESTRO_LIVE_ALLOW_EXTERNAL_URL !== 'true'
    ) {
      throw new Error(
        'Refusing live Maestro run with EXPO_PUBLIC_E2E_BYPASS=true and an external dev-client URL. ' +
        'Unset the bypass or set MAESTRO_LIVE_ALLOW_EXTERNAL_URL=true after verifying Metro is live-mode.'
      );
    }
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
    'Start Expo without E2E bypass first, or allow this script to autostart it.'
  );
}

function stopMetroIfStarted() {
  if (!metroProcess || metroProcess.killed) return;
  metroProcess.kill('SIGTERM');
}

const flows = process.argv.slice(2);
if (flows.includes('-h') || flows.includes('--help')) {
  console.log(`Usage: node scripts/runMaestroLive.mjs [flow ...]

Runs live Maestro flows with Expo Metro started as EXPO_PUBLIC_E2E_BYPASS=false.
Defaults to e2e/maestro/flows/test/. Override with:
  MAESTRO_LIVE_EXPO_PORT=<port>
  MAESTRO_EXPO_DEV_CLIENT_URL=<url>
  MAESTRO_LIVE_REUSE_METRO=true
  MAESTRO_LIVE_REPORT_PATH=<path|off>`);
  process.exit(0);
}

const targetFlows = flows.length > 0 ? flows : DEFAULT_FLOWS;

try {
  const devClientUrl = await resolveDevClientUrl();
  let failed = 0;

  for (const flow of targetFlows) {
    console.log(`\nRunning live Maestro flow: ${flow}`);
    const flowStartedAt = Date.now();
    const result = spawnSync('maestro', [
      'test',
      '-e',
      `MAESTRO_EXPO_DEV_CLIENT_URL=${devClientUrl}`,
      '-e',
      'EXPO_PUBLIC_E2E_BYPASS=false',
      flow,
    ], {
      cwd: process.cwd(),
      env: liveEnvironment({ MAESTRO_EXPO_DEV_CLIENT_URL: devClientUrl }),
      stdio: 'inherit',
    });

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
