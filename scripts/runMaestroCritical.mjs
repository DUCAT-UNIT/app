#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';

const APP_ID = 'com.ducatprotocol.DucatProtocolWallet';
const DEFAULT_FLOWS = [
  'e2e/maestro/flows/auth/01-create-wallet.yaml',
  'e2e/maestro/flows/send/03-send-invalid-address.yaml',
  'e2e/maestro/flows/settings/17-enable-usdc.yaml',
  'e2e/maestro/flows/wallet/18-sepolia-usdc-send-validation.yaml',
];

const DEFAULT_EXPO_PORT = 8081;
const explicitPort = process.env.MAESTRO_EXPO_PORT || process.env.EXPO_DEV_SERVER_PORT;
const candidatePorts = [explicitPort ? Number(explicitPort) : DEFAULT_EXPO_PORT]
  .filter((port) => Number.isInteger(port) && port > 0);

let metroProcess = null;

function e2eEnvironment(extra = {}) {
  return {
    ...process.env,
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

async function ensureProjectMetro(port) {
  if (await statusForPort(port)) return true;

  if (process.env.MAESTRO_EXPO_AUTOSTART === 'false') {
    return false;
  }

  console.log(`Starting Expo Metro for this project on port ${port}...`);
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
    env: e2eEnvironment({ CI: '1' }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  metroProcess.stdout?.on('data', (chunk) => process.stderr.write(`[metro] ${chunk}`));
  metroProcess.stderr?.on('data', (chunk) => process.stderr.write(`[metro] ${chunk}`));

  return waitForMetro(port, 90_000);
}

async function resolveDevClientUrl() {
  if (process.env.MAESTRO_EXPO_DEV_CLIENT_URL) {
    return process.env.MAESTRO_EXPO_DEV_CLIENT_URL;
  }

  for (const port of candidatePorts) {
    if (await ensureProjectMetro(port)) {
      const metroUrl = `http://localhost:${port}`;
      return `${APP_ID}://expo-development-client/?url=${encodeURIComponent(metroUrl)}`;
    }
  }

  throw new Error(
    `No Expo Metro server was found on ports ${candidatePorts.join(', ')}. ` +
    'Start Expo first, or set MAESTRO_EXPO_DEV_CLIENT_URL/MAESTRO_EXPO_PORT.'
  );
}

function stopMetroIfStarted() {
  if (!metroProcess || metroProcess.killed) return;
  metroProcess.kill('SIGTERM');
}

const flows = process.argv.slice(2);
if (flows.includes('-h') || flows.includes('--help')) {
  console.log(`Usage: node scripts/runMaestroCritical.mjs [flow ...]

Runs the critical Maestro suite with MAESTRO_EXPO_DEV_CLIENT_URL
resolved from the active Expo Metro server. Override with:
  MAESTRO_EXPO_DEV_CLIENT_URL=<url>
  MAESTRO_EXPO_PORT=<port>`);
  process.exit(0);
}

const targetFlows = flows.length > 0 ? flows : DEFAULT_FLOWS;

try {
  const devClientUrl = await resolveDevClientUrl();
  let failed = 0;

  for (const flow of targetFlows) {
    console.log(`\nRunning Maestro flow: ${flow}`);
    const result = spawnSync('maestro', [
      'test',
      '-e',
      `MAESTRO_EXPO_DEV_CLIENT_URL=${devClientUrl}`,
      flow,
    ], {
      cwd: process.cwd(),
      env: e2eEnvironment({ MAESTRO_EXPO_DEV_CLIENT_URL: devClientUrl }),
      stdio: 'inherit',
    });

    if (result.error) {
      throw result.error;
    }

    if ((result.status ?? 1) !== 0) {
      failed += 1;
    }
  }

  stopMetroIfStarted();
  process.exit(failed > 0 ? 1 : 0);
} catch (error) {
  stopMetroIfStarted();
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
