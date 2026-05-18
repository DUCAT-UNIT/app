/**
 * Guardian Service
 * Manages WebSocket connection to Guardian nodes for vault operations
 */

import { GuardianSocket, type ChainNetwork } from '@ducat-unit/client-sdk';
import { API, NETWORK_CONFIG, VAULT_CONFIG } from '../utils/constants';
import { logger } from '../utils/logger';

type GuardianSocketClient = GuardianSocket & {
  isError?: boolean;
  isConnected?: boolean;
};

// Singleton promise for guardian client
let gclientPromise: Promise<GuardianSocketClient> | null = null;
let currentClient: GuardianSocketClient | null = null;
let gclientPromiseStartedAt: number | null = null;

const PENDING_GUARDIAN_CONNECTION_MAX_AGE_MS = 15_000;

interface GuardianClientParams {
  url?: string;
  network?: ChainNetwork;
  pubkey: string;
}

/**
 * Creates a new Guardian WebSocket connection
 */
export async function createGuardianClient(
  params: GuardianClientParams
): Promise<GuardianSocketClient> {
  const url = params.url || API.GUARDIAN_WS;
  const network = params.network || NETWORK_CONFIG.vaultSdkNetwork;
  if (network !== NETWORK_CONFIG.vaultSdkNetwork) {
    throw new Error(`DUCAT mobile is Mutinynet-only. Unsupported Guardian network "${network}".`);
  }

  logger.info('[GuardianService] Creating new guardian client', { url });

  const client = new GuardianSocket(url, network, params.pubkey);
  currentClient = client as GuardianSocketClient;
  gclientPromiseStartedAt = Date.now();

  const clientPromise = new Promise<GuardianSocketClient>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      (client as GuardianSocketClient).isError = true;
      (client as GuardianSocketClient).isConnected = false;
      gclientPromise = null;
      gclientPromiseStartedAt = null;
      currentClient = null;
      logger.warn('[GuardianService] Guardian connection timed out', { url });
      reject(new Error('Guardian connection timeout'));
    }, 30_000); // 30 second connection timeout
    (timeout as { unref?: () => void }).unref?.();

    client.once('error', (error: unknown) => {
      const shouldReject = !settled;
      settled = true;
      clearTimeout(timeout);
      (client as GuardianSocketClient).isError = true;
      (client as GuardianSocketClient).isConnected = false;
      logger.error('[GuardianService] Socket error:', { error });
      gclientPromise = null;
      gclientPromiseStartedAt = null;
      currentClient = null;
      if (shouldReject) {
        reject(typeof error === 'string' ? new Error(`guardian: ${error}`) : error);
      }
    });

    client.once('close', () => {
      (client as GuardianSocketClient).isConnected = false;
      logger.debug('[GuardianService] Socket closed');
      gclientPromise = null;
      gclientPromiseStartedAt = null;
      currentClient = null;

      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error('Guardian connection closed before ready'));
      }
    });

    client.once('ready', () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      (client as GuardianSocketClient).isConnected = true;
      logger.info('[GuardianService] Socket ready', {
        durationMs: gclientPromiseStartedAt ? Date.now() - gclientPromiseStartedAt : undefined,
      });
      currentClient = client as GuardianSocketClient;
      resolve(client as GuardianSocketClient);
    });
  });

  gclientPromise = clientPromise;
  return clientPromise;
}

/**
 * Gets an existing connected client or creates a new one
 */
export async function getGuardianClient(pubkey: string): Promise<GuardianSocketClient> {
  // If we have a connected client, reuse it
  if (currentClient?.isConnected) {
    logger.debug('[GuardianService] Reusing existing connected client');
    return currentClient;
  }

  // If there's a pending connection, wait for it
  if (gclientPromise) {
    const pendingAgeMs = gclientPromiseStartedAt ? Date.now() - gclientPromiseStartedAt : 0;
    if (pendingAgeMs > PENDING_GUARDIAN_CONNECTION_MAX_AGE_MS) {
      logger.warn('[GuardianService] Discarding stale pending guardian connection', {
        pendingAgeMs,
      });
      disconnectGuardian();
    } else {
      logger.debug('[GuardianService] Waiting for pending connection');
      try {
        return await gclientPromise;
      } catch (error: unknown) {
        // Connection failed, will create new one below
        logger.debug('[GuardianService] Pending connection failed, creating new one', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // Create new connection
  return createGuardianClient({ pubkey });
}

/**
 * Disconnects the current guardian client
 */
export function disconnectGuardian(): void {
  if (currentClient) {
    logger.debug('[GuardianService] Disconnecting guardian client');
    try {
      // SDK doesn't expose a public close() method — access underlying WebSocket directly
      (currentClient as any)._socket?.close();
    } catch (e) {
      logger.debug('[GuardianService] Error closing socket', { error: (e as Error).message });
    }
  }
  currentClient = null;
  gclientPromise = null;
  gclientPromiseStartedAt = null;
}

/**
 * Checks if we have an active guardian connection
 */
export function isGuardianConnected(): boolean {
  return currentClient?.isConnected === true;
}

/**
 * Waits for a guardian operation with timeout
 */
export async function withGuardianTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number = VAULT_CONFIG.TX_TIMEOUT
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Guardian operation timeout'));
    }, timeoutMs);
    (timeoutId as { unref?: () => void }).unref?.();
  });

  return Promise.race([operation, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}
