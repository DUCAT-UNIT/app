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

  logger.debug(`[GuardianService] Creating new guardian client for ${url}`);

  const client = new GuardianSocket(url, network, params.pubkey);

  const clientPromise = new Promise<GuardianSocketClient>((resolve, reject) => {
    const timeout = setTimeout(() => {
      (client as GuardianSocketClient).isError = true;
      (client as GuardianSocketClient).isConnected = false;
      reject(new Error('Guardian connection timeout'));
    }, 30_000); // 30 second connection timeout
    (timeout as { unref?: () => void }).unref?.();

    client.once('error', (error: unknown) => {
      clearTimeout(timeout);
      (client as GuardianSocketClient).isError = true;
      (client as GuardianSocketClient).isConnected = false;
      logger.error('[GuardianService] Socket error:', { error });
      gclientPromise = null;
      currentClient = null;
      reject(typeof error === 'string' ? new Error(`guardian: ${error}`) : error);
    });

    client.once('close', () => {
      clearTimeout(timeout);
      (client as GuardianSocketClient).isConnected = false;
      logger.debug('[GuardianService] Socket closed');
      gclientPromise = null;
      currentClient = null;
    });

    client.once('ready', () => {
      clearTimeout(timeout);
      (client as GuardianSocketClient).isConnected = true;
      logger.debug('[GuardianService] Socket ready');
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
export async function getGuardianClient(
  pubkey: string
): Promise<GuardianSocketClient> {
  // If we have a connected client, reuse it
  if (currentClient?.isConnected) {
    logger.debug('[GuardianService] Reusing existing connected client');
    return currentClient;
  }

  // If there's a pending connection, wait for it
  if (gclientPromise) {
    logger.debug('[GuardianService] Waiting for pending connection');
    try {
      return await gclientPromise;
    } catch (error: unknown) {
      // Connection failed, will create new one below
      logger.debug('[GuardianService] Pending connection failed, creating new one', { error: error instanceof Error ? error.message : String(error) });
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
    currentClient = null;
    gclientPromise = null;
  }
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
