#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { dirname, resolve } from 'node:path';
import { loadProjectEnvironment } from './loadEnv.mjs';

loadProjectEnvironment();

const APP_ID = 'com.ducatprotocol.DucatProtocolWallet';
const DEFAULT_FLOWS = ['e2e/maestro/flows/test/'];
const DEFAULT_EXPO_PORT = 8081;
const DEFAULT_REPORT_PATH = 'artifacts/live-maestro/last-run.json';
const DEFAULT_CASHU_MINT_URL = 'https://dev-cashu-mint.ducatprotocol.com';
const DEFAULT_DRIVER_CRASH_RETRIES = 1;
const DEFAULT_FLOW_TIMEOUT_MS = 20 * 60_000;
const DEFAULT_DRIVER_CRASH_HANG_TIMEOUT_MS = 15_000;
const SIMULATOR_CLIPBOARD_TIMEOUT_MS = 5_000;
const DEFAULT_REVIEWER_MNEMONIC =
  'pool token pledge wagon rebuild vast bracket denial fashion cattle pave royal';
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
const driverCrashRetries = Number.isInteger(Number(process.env.MAESTRO_DRIVER_CRASH_RETRIES))
  ? Math.max(0, Number(process.env.MAESTRO_DRIVER_CRASH_RETRIES))
  : DEFAULT_DRIVER_CRASH_RETRIES;
const flowTimeoutMs = Number.isInteger(Number(process.env.MAESTRO_FLOW_TIMEOUT_MS))
  ? Math.max(30_000, Number(process.env.MAESTRO_FLOW_TIMEOUT_MS))
  : DEFAULT_FLOW_TIMEOUT_MS;
const driverCrashHangTimeoutMs = Number.isInteger(
  Number(process.env.MAESTRO_DRIVER_CRASH_HANG_TIMEOUT_MS)
)
  ? Math.max(1_000, Number(process.env.MAESTRO_DRIVER_CRASH_HANG_TIMEOUT_MS))
  : DEFAULT_DRIVER_CRASH_HANG_TIMEOUT_MS;

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
  return (process.env.EXPO_PUBLIC_CASHU_MINT_URL || DEFAULT_CASHU_MINT_URL).replace(/\/+$/, '');
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

function appendCapturedOutput(current, chunk) {
  const next = `${current}${chunk}`;
  return next.length > 500_000 ? next.slice(-500_000) : next;
}

function isRetryableMaestroDriverCrash(output) {
  return (
    output.includes('kAXErrorInvalidUIElement') ||
    output.includes('Request for viewHierarchy failed')
  );
}

function signalProcessTree(child, signal) {
  if (!child || child.killed) return;

  try {
    if (process.platform !== 'win32' && child.pid) {
      process.kill(-child.pid, signal);
    } else {
      child.kill(signal);
    }
  } catch {
    try {
      child.kill(signal);
    } catch {
      // Already exited.
    }
  }
}

function runMaestroOnce(flow, devClientUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'maestro',
      ['test', ...maestroEnvArgs({ MAESTRO_EXPO_DEV_CLIENT_URL: devClientUrl }), flow],
      {
        cwd: process.cwd(),
        env: liveEnvironment({ MAESTRO_EXPO_DEV_CLIENT_URL: devClientUrl }),
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
      }
    );

    let output = '';
    let settled = false;
    let retryableCrashKillTimer = null;

    const clearTimers = () => {
      clearTimeout(flowTimer);
      clearTimeout(retryableCrashKillTimer);
    };

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimers();
      resolve(result);
    };

    const killAfterRetryableCrash = () => {
      if (settled || retryableCrashKillTimer || !isRetryableMaestroDriverCrash(output)) {
        return;
      }

      retryableCrashKillTimer = setTimeout(() => {
        if (settled) return;
        console.warn(
          `Maestro reported a retryable XCUITest hierarchy crash in ${flow}; ` +
            'terminating the stale process tree before retry.'
        );
        signalProcessTree(child, 'SIGTERM');
        setTimeout(() => {
          if (!settled) signalProcessTree(child, 'SIGKILL');
        }, 2_000);
      }, driverCrashHangTimeoutMs);
    };

    const flowTimer = setTimeout(() => {
      if (settled) return;
      output = appendCapturedOutput(
        output,
        `\n[runMaestroLive] Flow timed out after ${flowTimeoutMs}ms: ${flow}\n`
      );
      console.error(`[runMaestroLive] Flow timed out after ${flowTimeoutMs}ms: ${flow}`);
      signalProcessTree(child, 'SIGTERM');
      setTimeout(() => {
        if (!settled) signalProcessTree(child, 'SIGKILL');
      }, 2_000);
    }, flowTimeoutMs);

    child.stdout?.on('data', (chunk) => {
      process.stdout.write(chunk);
      output = appendCapturedOutput(output, chunk.toString('utf8'));
      killAfterRetryableCrash();
    });
    child.stderr?.on('data', (chunk) => {
      process.stderr.write(chunk);
      output = appendCapturedOutput(output, chunk.toString('utf8'));
      killAfterRetryableCrash();
    });
    child.on('error', reject);
    child.on('close', (status, signal) => {
      finish({
        status: status ?? 1,
        signal: signal ?? null,
        output,
      });
    });
  });
}

async function runMaestroFlowWithDriverRetry(flow, devClientUrl) {
  let lastResult = null;

  for (let attempt = 0; attempt <= driverCrashRetries; attempt += 1) {
    primeReviewerSeedClipboard();
    const result = await runMaestroOnce(flow, devClientUrl);
    lastResult = result;

    if ((result.status ?? 1) === 0) {
      return { ...result, attempts: attempt + 1, retryReason: null };
    }

    if (attempt < driverCrashRetries && isRetryableMaestroDriverCrash(result.output)) {
      const nextAttempt = attempt + 2;
      console.warn(
        `Retrying ${flow} after transient Maestro/XCUITest hierarchy crash ` +
          `(attempt ${nextAttempt}/${driverCrashRetries + 1})...`
      );
      await wait(5_000);
      continue;
    }

    return {
      ...result,
      attempts: attempt + 1,
      retryReason: isRetryableMaestroDriverCrash(result.output)
        ? 'maestro_xcuitest_hierarchy_crash'
        : null,
    };
  }

  return {
    ...(lastResult ?? { status: 1, signal: null, output: '' }),
    attempts: driverCrashRetries + 1,
    retryReason:
      lastResult?.output && isRetryableMaestroDriverCrash(lastResult.output)
        ? 'maestro_xcuitest_hierarchy_crash'
        : null,
  };
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
  MAESTRO_FLOW_TIMEOUT_MS=<ms>
  MAESTRO_DRIVER_CRASH_HANG_TIMEOUT_MS=<ms>

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
    const result = await runMaestroFlowWithDriverRetry(flow, devClientUrl);
    const status = result.status ?? 1;
    const passed = status === 0;

    if (!passed) {
      failed += 1;
    }

    liveReport.flows.push({
      flow,
      result: passed ? 'passed' : 'failed',
      status,
      signal: result.signal ?? null,
      durationMs: Date.now() - flowStartedAt,
      passed,
      attempts: result.attempts,
      retryReason: result.retryReason,
    });
  }

  stopMetroIfStarted();
  const allFlowsPassed =
    liveReport.flows.length === targetFlows.length &&
    liveReport.flows.length > 0 &&
    liveReport.flows.every((flow) => flow.result === 'passed' && flow.passed === true);
  liveReport.result = failed > 0 || !allFlowsPassed ? 'failed' : 'passed';
  liveReport.metro.startedByScript = metroStartedByScript;
  writeLiveReport();
  process.exit(liveReport.result === 'passed' ? 0 : 1);
} catch (error) {
  stopMetroIfStarted();
  const message = error instanceof Error ? error.message : String(error);
  liveReport.result = 'failed';
  liveReport.error = message;
  writeLiveReport();
  console.error(message);
  process.exit(1);
}
