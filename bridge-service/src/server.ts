import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { BRIDGE_CONFIG, isBridgeAdminAuthEnabled, isLiveBridgeRuntimeConfigured } from './config';
import { BridgeRuntime } from './runtime';
import type { BridgeIntent, CreateBridgeIntentRequest, TrackRedemptionRequest } from './types';

const runtime = new BridgeRuntime();
const coordinator = runtime.coordinator;
const adminRoot = existsSync(join(process.cwd(), 'bridge-service/public/admin'))
  ? join(process.cwd(), 'bridge-service/public/admin')
  : join(process.cwd(), 'public/admin');

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload, null, 2));
}

function setBridgeIntentHeaders(response: ServerResponse, intent: BridgeIntent): void {
  response.setHeader('Access-Control-Expose-Headers', [
    'X-Bridge-Intent-Id',
    'X-Bridge-Client-Request-Id',
    'X-Bridge-Intent-Created-At',
    'X-Bridge-Intent-Updated-At',
    'X-Bridge-Deposit-Address',
    'X-Bridge-Deposit-Index',
    'X-Bridge-Sepolia-Recipient',
    'X-Bridge-Amount',
    'X-Bridge-Auto-Swap',
    'X-Bridge-Status',
  ].join(', '));
  response.setHeader('X-Bridge-Intent-Id', intent.id);
  response.setHeader('X-Bridge-Client-Request-Id', intent.clientRequestId || '');
  response.setHeader('X-Bridge-Intent-Created-At', intent.createdAt);
  response.setHeader('X-Bridge-Intent-Updated-At', intent.updatedAt);
  response.setHeader('X-Bridge-Deposit-Address', intent.depositAddress);
  response.setHeader('X-Bridge-Deposit-Index', intent.depositIndex !== undefined ? String(intent.depositIndex) : '');
  response.setHeader('X-Bridge-Sepolia-Recipient', intent.sepoliaRecipient);
  response.setHeader('X-Bridge-Amount', intent.amount);
  response.setHeader('X-Bridge-Auto-Swap', String(intent.autoSwap));
  response.setHeader('X-Bridge-Status', intent.status);
}

function sendBridgeIntent(response: ServerResponse, statusCode: number, intent: BridgeIntent): void {
  setBridgeIntentHeaders(response, intent);
  sendJson(response, statusCode, { intent });
}

async function readBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return (raw ? JSON.parse(raw) : {}) as T;
}

function serveAdminAsset(pathname: string, response: ServerResponse): boolean {
  const relativePath = pathname === '/admin' || pathname === '/admin/'
    ? 'index.html'
    : pathname.replace(/^\/admin\/?/, '');
  const target = join(adminRoot, relativePath);

  if (!existsSync(target)) {
    return false;
  }

  const ext = extname(target);
  const contentType = ext === '.js'
    ? 'text/javascript; charset=utf-8'
    : ext === '.css'
      ? 'text/css; charset=utf-8'
      : 'text/html; charset=utf-8';
  response.statusCode = 200;
  response.setHeader('Content-Type', contentType);
  response.end(readFileSync(target));
  return true;
}

function requireAdminAuth(request: IncomingMessage, response: ServerResponse): boolean {
  if (!isBridgeAdminAuthEnabled()) {
    return true;
  }

  const header = request.headers.authorization;
  const expected = `Bearer ${BRIDGE_CONFIG.adminToken}`;
  if (header === expected) {
    return true;
  }

  response.statusCode = 401;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('WWW-Authenticate', 'Bearer realm="unit-bridge-admin"');
  response.end(JSON.stringify({ error: 'Admin authorization required' }, null, 2));
  return false;
}

function commit<T>(operation: () => T): T {
  const result = operation();
  runtime.save();
  return result;
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://localhost');
    const pathname = url.pathname;
    const method = request.method || 'GET';

    if (pathname.startsWith('/admin') && method === 'GET' && serveAdminAsset(pathname, response)) {
      return;
    }

    if (pathname === '/health' && method === 'GET') {
      return sendJson(response, 200, {
        ok: true,
        runtimeEnabled: BRIDGE_CONFIG.runtimeEnabled,
        liveMode: BRIDGE_CONFIG.liveMode,
        liveRuntimeConfigured: isLiveBridgeRuntimeConfigured(),
        adminAuthEnabled: isBridgeAdminAuthEnabled(),
        adminUiTokenPrompt: BRIDGE_CONFIG.adminUiTokenPrompt,
        stateFilePath: BRIDGE_CONFIG.stateFilePath,
        sepolia: {
          chainId: BRIDGE_CONFIG.sepolia.chainId,
          usdcAddress: BRIDGE_CONFIG.sepoliaUsdcAddress,
          wunitConfigured: Boolean(BRIDGE_CONFIG.sepolia.wunitAddress),
          poolConfigured: Boolean(BRIDGE_CONFIG.sepolia.poolAddress),
          routerConfigured: Boolean(BRIDGE_CONFIG.sepolia.routerAddress),
        },
      });
    }

    if (pathname.startsWith('/admin') && !requireAdminAuth(request, response)) {
      return;
    }

    if (pathname === '/bridge/intents' && method === 'POST') {
      const body = await readBody<CreateBridgeIntentRequest>(request);
      const intent = runtime.createIntent(body);
      return sendBridgeIntent(response, 201, intent);
    }

    if (pathname === '/bridge/create-intent' && method === 'GET') {
      const amount = url.searchParams.get('amount') || '';
      const sepoliaRecipient = url.searchParams.get('sepoliaRecipient') || '';
      const clientRequestId = url.searchParams.get('requestId')
        || url.searchParams.get('clientRequestId')
        || url.searchParams.get('clientrequestid')
        || undefined;
      const autoSwapParam = url.searchParams.get('autoSwap');
      const autoSwap = autoSwapParam === null ? true : autoSwapParam === 'true';

      const intent = runtime.createIntent({
        amount,
        clientRequestId,
        sepoliaRecipient,
        autoSwap,
      });
      return sendBridgeIntent(response, 201, intent);
    }

    if (pathname.startsWith('/bridge/intents/by-client-request-id/') && method === 'GET') {
      const clientRequestId = decodeURIComponent(pathname.split('/').pop() || '');
      const intent = coordinator.getIntentByClientRequestId(clientRequestId);
      if (!intent) {
        return sendJson(response, 404, { error: 'Intent not found' });
      }
      return sendBridgeIntent(response, 200, intent);
    }

    if (pathname.startsWith('/bridge/intents/') && method === 'GET') {
      const id = pathname.split('/').pop() || '';
      const intent = coordinator.getIntent(id);
      if (!intent) {
        return sendJson(response, 404, { error: 'Intent not found' });
      }
      return sendJson(response, 200, intent);
    }

    if (pathname === '/redemptions' && method === 'POST') {
      const body = await readBody<TrackRedemptionRequest>(request);
      const redemption = commit(() => coordinator.trackRedemption(body));
      return sendJson(response, 201, { redemption });
    }

    if (pathname.startsWith('/redemptions/') && method === 'GET') {
      const id = pathname.split('/').pop() || '';
      const redemption = coordinator.getRedemption(id);
      if (!redemption) {
        return sendJson(response, 404, { error: 'Redemption not found' });
      }
      return sendJson(response, 200, redemption);
    }

    if (pathname === '/admin/overview' && method === 'GET') {
      return sendJson(response, 200, coordinator.getAdminState());
    }

    if (pathname === '/admin/reconciliation' && method === 'GET') {
      return sendJson(response, 200, coordinator.getReconciliation());
    }

    if (pathname === '/admin/pool' && method === 'GET') {
      return sendJson(response, 200, coordinator.getPoolPosition());
    }

    if (pathname === '/admin/liquidity/seed' && method === 'POST') {
      const body = await readBody<{ wunitAmount: string; usdcAmount: string }>(request);
      return sendJson(response, 200, commit(() => coordinator.seedLiquidity(body.wunitAmount, body.usdcAmount)));
    }

    if (pathname === '/admin/liquidity/add' && method === 'POST') {
      const body = await readBody<{ wunitAmount: string; usdcAmount: string }>(request);
      return sendJson(response, 200, commit(() => coordinator.addLiquidity(body.wunitAmount, body.usdcAmount)));
    }

    if (pathname === '/admin/liquidity/remove' && method === 'POST') {
      const body = await readBody<{ shareBps: string }>(request);
      return sendJson(response, 200, commit(() => coordinator.removeLiquidity(body.shareBps)));
    }

    if (pathname === '/admin/bridge/pause' && method === 'POST') {
      const body = await readBody<{ paused: boolean }>(request);
      commit(() => coordinator.setBridgePaused(Boolean(body.paused)));
      return sendJson(response, 200, { paused: Boolean(body.paused) });
    }

    if (pathname === '/admin/pool/pause' && method === 'POST') {
      const body = await readBody<{ paused: boolean }>(request);
      commit(() => coordinator.setPoolPaused(Boolean(body.paused)));
      return sendJson(response, 200, { paused: Boolean(body.paused) });
    }

    if (pathname.match(/^\/admin\/intents\/[^/]+\/simulate-deposit$/) && method === 'POST') {
      const intentId = pathname.split('/')[3] || '';
      const body = await readBody<{ amount: string; txid?: string; confirmations?: number }>(request);
      return sendJson(
        response,
        200,
        commit(() => coordinator.simulateDeposit(intentId, body.amount, body.txid, body.confirmations)),
      );
    }

    if (pathname.match(/^\/admin\/intents\/[^/]+\/resolve$/) && method === 'POST') {
      const intentId = pathname.split('/')[3] || '';
      const body = await readBody<{ resolution: 'credit_wunit' | 'retry_swap' | 'mark_failed' }>(request);
      return sendJson(response, 200, commit(() => coordinator.manualResolveIntent(intentId, body.resolution)));
    }

    if (pathname === '/admin/recovery/replay' && method === 'POST') {
      const body = await readBody<{ intentId: string }>(request);
      return sendJson(response, 200, commit(() => coordinator.replayIntent(body.intentId)));
    }

    if (pathname.match(/^\/admin\/redemptions\/[^/]+\/complete$/) && method === 'POST') {
      const redemptionId = pathname.split('/')[3] || '';
      const body = await readBody<{ releaseTxid?: string }>(request);
      return sendJson(response, 200, commit(() => coordinator.completeRedemption(redemptionId, body.releaseTxid)));
    }

    if (pathname.match(/^\/admin\/redemptions\/[^/]+\/replay$/) && method === 'POST') {
      const redemptionId = pathname.split('/')[3] || '';
      return sendJson(response, 200, commit(() => coordinator.replayRedemption(redemptionId)));
    }

    return sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    return sendJson(response, 400, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

const port = Number(process.env.PORT || 8788);

if (require.main === module) {
  runtime.start();
  process.on('SIGINT', () => {
    runtime.stop();
    server.close(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    runtime.stop();
    server.close(() => process.exit(0));
  });
  server.listen(port, () => {
    process.stdout.write(`UNIT bridge service listening on http://localhost:${port}\n`);
  });
}

export { server, coordinator, runtime };
