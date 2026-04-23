import { EVM_CONFIG } from '../constants/evm';
import { getJSON, postJSON } from '../utils/apiClient';
import { logger } from '../utils/logger';
import type {
  BridgeIntent,
  BridgeIntentStatus,
  CreateBridgeIntentRequest,
  CreateBridgeIntentResponse,
  PoolPosition,
  ReconciliationSnapshot,
  RedemptionRequest,
  TrackRedemptionRequest,
} from '../shared/bridgeTypes';

const BRIDGE_CREATE_TIMEOUT_MS = 8_000;
const BRIDGE_LOOKUP_TIMEOUT_MS = 1_500;
const BRIDGE_LOOKUP_TOTAL_WAIT_MS = 12_000;
const BRIDGE_LOOKUP_RETRY_DELAY_MS = 400;

function buildUrl(path: string): string {
  return `${EVM_CONFIG.bridgeApiBaseUrl}${path}`;
}

function buildBridgeTimeoutError(): Error {
  return new Error('Bridge request timed out while creating the deposit address.');
}

function buildClientRequestId(): string {
  return `bridge_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && /not found/i.test(error.message);
}

function parseIntentPayload(raw: string): Partial<CreateBridgeIntentResponse> & { error?: string; message?: string } {
  return raw
    ? JSON.parse(raw) as Partial<CreateBridgeIntentResponse> & { error?: string; message?: string }
    : {};
}

function parseBridgeIntentHeaders(headers?: Pick<Headers, 'get'> | null): BridgeIntent | null {
  if (!headers || typeof headers.get !== 'function') {
    return null;
  }

  const id = headers.get('x-bridge-intent-id');
  const createdAt = headers.get('x-bridge-intent-created-at');
  const updatedAt = headers.get('x-bridge-intent-updated-at');
  const depositAddress = headers.get('x-bridge-deposit-address');
  const sepoliaRecipient = headers.get('x-bridge-sepolia-recipient');
  const amount = headers.get('x-bridge-amount');
  const autoSwap = headers.get('x-bridge-auto-swap');
  const status = headers.get('x-bridge-status');

  if (!id || !createdAt || !updatedAt || !depositAddress || !sepoliaRecipient || !amount || !autoSwap || !status) {
    return null;
  }

  const depositIndexRaw = headers.get('x-bridge-deposit-index');
  const depositIndex = depositIndexRaw ? Number(depositIndexRaw) : undefined;
  const clientRequestId = headers.get('x-bridge-client-request-id') || undefined;

  return {
    id,
    clientRequestId,
    createdAt,
    updatedAt,
    depositAddress,
    depositIndex: Number.isFinite(depositIndex) ? depositIndex : undefined,
    sepoliaRecipient,
    amount,
    autoSwap: autoSwap === 'true',
    status: status as BridgeIntentStatus,
  };
}

async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  return Promise.race<Response>([
    fetch(url, init),
    new Promise<Response>((_, reject) => {
      setTimeout(() => reject(buildBridgeTimeoutError()), timeoutMs);
    }),
  ]);
}

async function readIntentResponse(response: Response): Promise<BridgeIntent> {
  const intentFromHeaders = parseBridgeIntentHeaders(response.headers);
  if (response.ok && intentFromHeaders) {
    return intentFromHeaders;
  }

  const raw = await response.text();
  const payload = parseIntentPayload(raw);

  if (!response.ok) {
    throw new Error(payload.error || payload.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  if (!payload.intent) {
    throw new Error('Bridge intent response was missing intent data');
  }

  return payload.intent;
}

async function createBridgeIntentViaGet(request: CreateBridgeIntentRequest): Promise<BridgeIntent> {
  const params = new URLSearchParams({
    amount: request.amount,
    autoSwap: String(request.autoSwap ?? true),
    requestId: request.clientRequestId || '',
    sepoliaRecipient: request.sepoliaRecipient,
  });
  const url = `${buildUrl('/bridge/create-intent')}?${params.toString()}`;
  const start = Date.now();
  const response = await fetchWithTimeout(`${buildUrl('/bridge/create-intent')}?${params.toString()}`, BRIDGE_CREATE_TIMEOUT_MS, {
    method: 'GET',
  });
  logger.api(url, 'GET', response.status, Date.now() - start);
  return readIntentResponse(response);
}

async function createBridgeIntentViaPost(request: CreateBridgeIntentRequest): Promise<BridgeIntent> {
  const url = buildUrl('/bridge/intents');
  const start = Date.now();
  const response = await fetchWithTimeout(url, BRIDGE_CREATE_TIMEOUT_MS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  logger.api(url, 'POST', response.status, Date.now() - start);
  return readIntentResponse(response);
}

async function getBridgeIntentByClientRequestId(clientRequestId: string): Promise<BridgeIntent | null> {
  const url = buildUrl(`/bridge/intents/by-client-request-id/${encodeURIComponent(clientRequestId)}`);
  const start = Date.now();
  const response = await fetchWithTimeout(
    url,
    BRIDGE_LOOKUP_TIMEOUT_MS,
    { method: 'GET' },
  );
  logger.api(url, 'GET', response.status, Date.now() - start);

  if (response.status === 404) {
    return null;
  }

  return readIntentResponse(response);
}

async function waitForBridgeIntent(clientRequestId: string): Promise<BridgeIntent> {
  const deadline = Date.now() + BRIDGE_LOOKUP_TOTAL_WAIT_MS;

  while (Date.now() < deadline) {
    try {
      const intent = await getBridgeIntentByClientRequestId(clientRequestId);
      if (intent) {
        return intent;
      }
    } catch (error) {
      if (error instanceof Error && !error.message.includes('timed out') && !isNotFoundError(error)) {
        throw error;
      }
    }

    await delay(BRIDGE_LOOKUP_RETRY_DELAY_MS);
  }

  throw buildBridgeTimeoutError();
}

export async function createBridgeIntent(request: CreateBridgeIntentRequest): Promise<BridgeIntent> {
  const clientRequestId = request.clientRequestId || buildClientRequestId();
  const requestWithClientId: CreateBridgeIntentRequest = {
    ...request,
    clientRequestId,
  };
  logger.info('[BridgeApi] Creating bridge intent', {
    amount: requestWithClientId.amount,
    clientRequestId,
    sepoliaRecipient: requestWithClientId.sepoliaRecipient,
  });

  const createPromise = (async (): Promise<BridgeIntent> => {
    try {
      return await createBridgeIntentViaGet(requestWithClientId);
    } catch (error) {
      if (isNotFoundError(error)) {
        return createBridgeIntentViaPost(requestWithClientId);
      }
      throw error;
    }
  })();

  const lookupPromise = waitForBridgeIntent(clientRequestId);

  try {
    const intent = await Promise.any([createPromise, lookupPromise]);
    logger.info('[BridgeApi] Bridge intent ready', {
      clientRequestId,
      depositAddress: intent.depositAddress,
      intentId: intent.id,
      status: intent.status,
    });
    return intent;
  } catch (error) {
    logger.error(error, {
      clientRequestId,
      scope: 'createBridgeIntent',
    });
    if (error instanceof AggregateError) {
      const typedErrors = error.errors.filter((value): value is Error => value instanceof Error);
      const timeoutError = typedErrors.find((value) => value.message.includes('timed out'));
      if (timeoutError) {
        throw timeoutError;
      }
      if (typedErrors[0]) {
        throw typedErrors[0];
      }
    }

    throw error;
  }
}

export async function getBridgeStatus(intentId: string): Promise<BridgeIntent> {
  return getJSON<BridgeIntent>(buildUrl(`/bridge/intents/${intentId}`), {
    description: 'Fetch Sepolia bridge intent status',
  });
}

export async function trackRedemption(
  request: TrackRedemptionRequest,
): Promise<RedemptionRequest> {
  const response = await postJSON<{ redemption: RedemptionRequest }>(
    buildUrl('/redemptions'),
    request,
    { description: 'Track Sepolia redemption request' },
  );
  return response.redemption;
}

export async function getRedemptionStatus(redemptionId: string): Promise<RedemptionRequest> {
  return getJSON<RedemptionRequest>(buildUrl(`/redemptions/${redemptionId}`), {
    description: 'Fetch redemption release status',
  });
}

export async function getPoolPosition(): Promise<PoolPosition> {
  return getJSON<PoolPosition>(buildUrl('/admin/pool'), {
    description: 'Fetch bridge pool position',
  });
}

export async function getReconciliation(): Promise<ReconciliationSnapshot> {
  return getJSON<ReconciliationSnapshot>(buildUrl('/admin/reconciliation'), {
    description: 'Fetch bridge reconciliation snapshot',
  });
}
