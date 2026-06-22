#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import { loadProjectEnvironment } from './loadEnv.mjs';

loadProjectEnvironment();

const APP_ID = 'com.ducatprotocol.DucatProtocolWallet';
const DEFAULT_FLOWS = [
  'e2e/maestro/flows/auth/01-create-wallet.yaml',
  'e2e/maestro/flows/send/03-send-invalid-address.yaml',
  'e2e/maestro/flows/settings/17-enable-usdc.yaml',
  'e2e/maestro/flows/wallet/18-sepolia-usdc-send-validation.yaml',
];

const DEFAULT_EXPO_PORT = 8081;
const DEFAULT_EXPO_PORTS = [DEFAULT_EXPO_PORT, 8082, 8083];
const DEFAULT_REVIEWER_MNEMONIC =
  'pool token pledge wagon rebuild vast bracket denial fashion cattle pave royal';
const SIMULATOR_CLIPBOARD_TIMEOUT_MS = 5_000;
const DEFAULT_MAESTRO_FLOW_TIMEOUT_MS = 10 * 60 * 1000;
const MAESTRO_DRIVER_FAILURE_PATTERNS = [
  'kAXErrorInvalidUIElement',
  'Error getting element frame',
  'Request for viewHierarchy failed',
];
const explicitPort = process.env.MAESTRO_EXPO_PORT || process.env.EXPO_DEV_SERVER_PORT;
const candidatePorts = (explicitPort ? [Number(explicitPort)] : DEFAULT_EXPO_PORTS).filter(
  (port) => Number.isInteger(port) && port > 0
);
const maestroFlowTimeoutMs = parsePositiveInt(
  process.env.MAESTRO_FLOW_TIMEOUT_MS,
  DEFAULT_MAESTRO_FLOW_TIMEOUT_MS
);
const maestroFlowAttempts = parsePositiveInt(process.env.MAESTRO_FLOW_ATTEMPTS, 2);

let metroProcess = null;

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function e2eEnvironment(extra = {}) {
  return {
    ...process.env,
    EXPO_NO_TELEMETRY: '1',
    ...extra,
  };
}

function reviewerMnemonic() {
  const configured = process.env.DUCAT_LIVE_E2E_SEED_PHRASE;
  return typeof configured === 'string' && configured.trim()
    ? configured.trim()
    : DEFAULT_REVIEWER_MNEMONIC;
}

function primeReviewerSeedClipboard() {
  const result = spawnSync('xcrun', ['simctl', 'pbcopy', 'booted'], {
    input: reviewerMnemonic(),
    encoding: 'utf8',
    killSignal: 'SIGKILL',
    stdio: ['pipe', 'ignore', 'pipe'],
    timeout: SIMULATOR_CLIPBOARD_TIMEOUT_MS,
  });

  if ((result.status ?? 1) !== 0) {
    const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : '';
    const timeoutMessage =
      result.error?.code === 'ETIMEDOUT' ? ` after ${SIMULATOR_CLIPBOARD_TIMEOUT_MS}ms` : '';
    console.warn(
      `Could not prime simulator clipboard for reviewer wallet import${timeoutMessage}${
        stderr ? `: ${stderr}` : ''
      }`
    );
  }
}

function cleanupMaestroIosDrivers() {
  if (process.platform !== 'darwin') return;

  [
    'xcodebuild test-without-building.*maestro-driver-ios',
    'maestro-driver-iosUITests-Runner',
  ].forEach((pattern) => {
    spawnSync('pkill', ['-f', pattern], {
      stdio: 'ignore',
      timeout: 5_000,
      killSignal: 'SIGKILL',
    });
  });
}

function canConnectToPort(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const done = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(1500);
    socket.on('connect', () => done(true));
    socket.on('timeout', () => done(false));
    socket.on('error', () => done(false));
  });
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

  if (await canConnectToPort(port)) {
    console.warn(
      `Port ${port} accepts connections but is not reporting Expo Metro readiness; ` +
        'not using it for the dev-client launch.'
    );
    return false;
  }

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

function outputContainsDriverFailure(chunk) {
  const text = String(chunk);
  return MAESTRO_DRIVER_FAILURE_PATTERNS.some((pattern) => text.includes(pattern));
}

function runMaestroFlow(flow, devClientUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn('maestro', [
      'test',
      '-e',
      `MAESTRO_EXPO_DEV_CLIENT_URL=${devClientUrl}`,
      flow,
    ], {
      cwd: process.cwd(),
      env: e2eEnvironment({ MAESTRO_EXPO_DEV_CLIENT_URL: devClientUrl }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let settled = false;
    let timedOut = false;
    let driverFailure = false;

    const settle = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };

    const killChild = () => {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
      cleanupMaestroIosDrivers();
    };

    const timeout = setTimeout(() => {
      timedOut = true;
      killChild();
    }, maestroFlowTimeoutMs);

    child.stdout?.on('data', (chunk) => {
      process.stdout.write(chunk);
      if (outputContainsDriverFailure(chunk)) {
        driverFailure = true;
        killChild();
      }
    });
    child.stderr?.on('data', (chunk) => {
      process.stderr.write(chunk);
      if (outputContainsDriverFailure(chunk)) {
        driverFailure = true;
        killChild();
      }
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (status, signal) => {
      settle({ status, signal, timedOut, driverFailure });
    });
  });
}

function portFromDevClientUrl(devClientUrl) {
  try {
    const parsed = new URL(devClientUrl);
    const nestedUrl = parsed.searchParams.get('url');
    if (!nestedUrl) return null;
    const metroUrl = new URL(nestedUrl);
    const port = Number(metroUrl.port);
    return Number.isInteger(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
}

async function resolveDevClientTarget() {
  if (process.env.MAESTRO_EXPO_DEV_CLIENT_URL) {
    return {
      url: process.env.MAESTRO_EXPO_DEV_CLIENT_URL,
      metroPort: portFromDevClientUrl(process.env.MAESTRO_EXPO_DEV_CLIENT_URL),
    };
  }

  for (const port of candidatePorts) {
    if (await ensureProjectMetro(port)) {
      const metroUrl = `http://localhost:${port}`;
      return {
        url: `${APP_ID}://expo-development-client/?url=${encodeURIComponent(metroUrl)}`,
        metroPort: port,
      };
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
  const devClientTarget = await resolveDevClientTarget();
  let failed = 0;

  for (const flow of targetFlows) {
    let passed = false;

    for (let attempt = 1; attempt <= maestroFlowAttempts; attempt += 1) {
      const attemptLabel = maestroFlowAttempts > 1 ? ` (attempt ${attempt}/${maestroFlowAttempts})` : '';
      console.log(`\nRunning Maestro flow: ${flow}${attemptLabel}`);
      if (devClientTarget.metroPort && !(await ensureProjectMetro(devClientTarget.metroPort))) {
        throw new Error(`Metro is not running on port ${devClientTarget.metroPort}`);
      }
      cleanupMaestroIosDrivers();
      primeReviewerSeedClipboard();
      const result = await runMaestroFlow(flow, devClientTarget.url);

      if (result.timedOut) {
        console.error(`Maestro flow timed out after ${maestroFlowTimeoutMs}ms: ${flow}`);
      } else if (result.driverFailure) {
        console.error(`Maestro iOS driver failed; retrying with a clean driver: ${flow}`);
      } else if ((result.status ?? 1) === 0) {
        passed = true;
        break;
      }

      cleanupMaestroIosDrivers();
      if (attempt < maestroFlowAttempts) {
        console.warn(`Retrying Maestro flow after failed attempt: ${flow}`);
      }
    }

    if (!passed) {
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
