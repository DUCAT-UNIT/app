/**
 * Token Processing Store (Zustand)
 * Replaces global variables for cashu token processing
 * Provides type-safe state management for pending tokens
 */

import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { DEVICE_ONLY } from '../services/storagePolicy';
import { logger } from '../utils/logger';

// Max entries before evicting oldest half
const MAX_PROCESSED_HASHES = 1000;
export const PENDING_TOKEN_KEY = 'pending_turbo_cashu_token_v1';
export const PENDING_TOKEN_QUEUE_KEY = 'pending_turbo_cashu_token_queue_v1';
export const PAUSED_TOKEN_QUEUE_KEY = 'paused_turbo_cashu_token_queue_v1';

interface TokenProcessingState {
  // Pending token to be processed
  pendingToken: string | null;
  // Additional pending tokens waiting behind the current token
  pendingTokenQueue: string[];
  // Token currently being processed; kept durable until explicitly cleared
  processingToken: string | null;
  // Failed/deferred tokens kept durable but not retried in a tight loop
  pausedTokenQueue: string[];
  // Set of processed token hashes (to prevent double-processing)
  processedTokenHashes: Set<string>;
  // Callback to trigger token check
  tokenCheckCallback: (() => void) | null;
  // Callback to reload wallet UI
  walletReloadCallback: (() => void) | null;
}

interface TokenProcessingActions {
  // Set a pending token for processing
  setPendingToken: (token: string) => Promise<void>;
  // Clear the pending token (after processing)
  clearPendingToken: (token?: string) => void;
  // Stop treating a failed token as actively processing while keeping it durable
  pauseProcessingToken: (token: string) => void;
  // Get and clear pending token atomically
  consumePendingToken: () => string | null;
  // Restore a pending token that was queued before app exit
  hydratePendingToken: () => Promise<string | null>;
  // Mark a token as processed (by its hash)
  markTokenProcessed: (token: string) => Promise<void>;
  // Check if token was already processed
  isTokenProcessed: (token: string) => Promise<boolean>;
  // Register the token check callback
  registerTokenCheckCallback: (callback: () => void) => void;
  // Unregister the token check callback
  unregisterTokenCheckCallback: () => void;
  // Trigger the token check if callback is registered
  triggerTokenCheck: () => void;
  // Register the wallet reload callback
  registerWalletReloadCallback: (callback: () => void) => void;
  // Unregister the wallet reload callback
  unregisterWalletReloadCallback: () => void;
  // Trigger wallet reload if callback is registered
  triggerWalletReload: () => void;
  // Reset all state (for testing/logout)
  reset: () => void;
}

type TokenProcessingStore = TokenProcessingState & TokenProcessingActions;

const initialState: TokenProcessingState = {
  pendingToken: null,
  pendingTokenQueue: [],
  processingToken: null,
  pausedTokenQueue: [],
  processedTokenHashes: new Set<string>(),
  tokenCheckCallback: null,
  walletReloadCallback: null,
};

let tokenCheckTimer: ReturnType<typeof setTimeout> | null = null;

function clearTokenCheckTimer(): void {
  if (tokenCheckTimer) {
    clearTimeout(tokenCheckTimer);
    tokenCheckTimer = null;
  }
}

const uniqueTokens = (tokens: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const token of tokens) {
    if (!token || seen.has(token)) {
      continue;
    }
    seen.add(token);
    result.push(token);
  }
  return result;
};

const parseTokenQueue = (raw: string | null, storageKey: string): string[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return uniqueTokens(parsed.filter((token): token is string => typeof token === 'string'));
    }
  } catch (error) {
    logger.warn('[TokenProcessingStore] Failed to parse token queue', {
      error: error instanceof Error ? error.message : String(error),
      storageKey,
    });
  }

  return [];
};

const persistTokenQueues = async (
  pendingTokens: string[],
  pausedTokens: string[] = []
): Promise<void> => {
  const uniquePending = uniqueTokens(pendingTokens);
  const uniquePaused = uniqueTokens(pausedTokens);
  if (uniquePending.length === 0) {
    await Promise.all([
      SecureStore.deleteItemAsync(PENDING_TOKEN_KEY),
      SecureStore.deleteItemAsync(PENDING_TOKEN_QUEUE_KEY),
    ]);
  } else {
    await SecureStore.setItemAsync(
      PENDING_TOKEN_QUEUE_KEY,
      JSON.stringify(uniquePending),
      DEVICE_ONLY
    );
    await SecureStore.setItemAsync(PENDING_TOKEN_KEY, uniquePending[0], DEVICE_ONLY);
  }

  if (uniquePaused.length === 0) {
    await SecureStore.deleteItemAsync(PAUSED_TOKEN_QUEUE_KEY);
  } else {
    await SecureStore.setItemAsync(
      PAUSED_TOKEN_QUEUE_KEY,
      JSON.stringify(uniquePaused),
      DEVICE_ONLY
    );
  }
};

const persistPendingTokens = async (tokens: string[]): Promise<void> => {
  await persistTokenQueues(tokens, []);
};

const loadPersistedTokenQueues = async (): Promise<{
  pendingTokens: string[];
  pausedTokens: string[];
}> => {
  const queueRaw = await SecureStore.getItemAsync(PENDING_TOKEN_QUEUE_KEY);
  const pausedRaw = await SecureStore.getItemAsync(PAUSED_TOKEN_QUEUE_KEY);
  const pausedTokens = parseTokenQueue(pausedRaw, PAUSED_TOKEN_QUEUE_KEY);

  if (queueRaw) {
    const pendingTokens = parseTokenQueue(queueRaw, PENDING_TOKEN_QUEUE_KEY);
    if (pendingTokens.length > 0) {
      return { pendingTokens, pausedTokens };
    }
  }

  const legacyToken = await SecureStore.getItemAsync(PENDING_TOKEN_KEY);
  return { pendingTokens: legacyToken ? [legacyToken] : [], pausedTokens };
};

export const useTokenProcessingStore = create<TokenProcessingStore>((set, get) => ({
  ...initialState,

  setPendingToken: async (token: string) => {
    logger.debug('[TokenProcessingStore] Setting pending token');
    const current = get();
    const activeTokens = uniqueTokens([
      current.processingToken,
      current.pendingToken,
      ...current.pendingTokenQueue,
    ]);
    if (activeTokens.includes(token)) {
      logger.debug('[TokenProcessingStore] Pending token is already queued');
      return;
    }

    const nextPausedTokens = current.pausedTokenQueue.filter(
      (pausedToken) => pausedToken !== token
    );
    const nextTokens = [...activeTokens, token];
    try {
      await persistTokenQueues(nextTokens, nextPausedTokens);
    } catch (error) {
      logger.error('[TokenProcessingStore] Failed to persist pending token', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
    set((state) => {
      const pausedTokenQueue = state.pausedTokenQueue.filter(
        (pausedToken) => pausedToken !== token
      );
      if (!state.pendingToken) {
        return { pendingToken: token, pausedTokenQueue };
      }
      return { pendingTokenQueue: [...state.pendingTokenQueue, token], pausedTokenQueue };
    });
  },

  clearPendingToken: (token?: string) => {
    logger.debug('[TokenProcessingStore] Clearing pending token');
    if (!token) {
      set({
        pendingToken: null,
        pendingTokenQueue: [],
        processingToken: null,
        pausedTokenQueue: [],
      });
      Promise.resolve(persistPendingTokens([])).catch((error) => {
        logger.error('[TokenProcessingStore] Failed to clear persisted pending token', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
      return;
    }

    let durableTokens: string[] = [];
    let durablePausedTokens: string[] = [];
    set((state) => {
      const processingToken = state.processingToken === token ? null : state.processingToken;
      const unprocessed = uniqueTokens([
        state.pendingToken === token ? null : state.pendingToken,
        ...state.pendingTokenQueue.filter((queuedToken) => queuedToken !== token),
      ]);
      const pausedTokenQueue = state.pausedTokenQueue.filter(
        (queuedToken) => queuedToken !== token
      );
      durablePausedTokens = pausedTokenQueue;

      const pendingToken = processingToken
        ? (unprocessed[0] ?? null)
        : (unprocessed.shift() ?? null);
      const pendingTokenQueue = processingToken ? unprocessed.slice(1) : unprocessed;

      durableTokens = uniqueTokens([processingToken, pendingToken, ...pendingTokenQueue]);

      return {
        processingToken,
        pendingToken,
        pendingTokenQueue,
        pausedTokenQueue,
      };
    });

    Promise.resolve(persistTokenQueues(durableTokens, durablePausedTokens)).catch((error) => {
      logger.error('[TokenProcessingStore] Failed to clear persisted pending token', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  },

  pauseProcessingToken: (token: string) => {
    let durableTokens: string[] = [];
    let durablePausedTokens: string[] = [];
    set((state) => {
      if (state.processingToken !== token) {
        durableTokens = uniqueTokens([
          state.processingToken,
          state.pendingToken,
          ...state.pendingTokenQueue,
        ]);
        durablePausedTokens = state.pausedTokenQueue;
        return state;
      }

      const pausedTokenQueue = uniqueTokens([...state.pausedTokenQueue, token]);
      durablePausedTokens = pausedTokenQueue;
      const unprocessed = uniqueTokens([state.pendingToken, ...state.pendingTokenQueue]);
      const pendingToken = unprocessed.shift() ?? null;
      const pendingTokenQueue = unprocessed;
      durableTokens = uniqueTokens([pendingToken, ...pendingTokenQueue]);

      return {
        processingToken: null,
        pendingToken,
        pendingTokenQueue,
        pausedTokenQueue,
      };
    });

    Promise.resolve(persistTokenQueues(durableTokens, durablePausedTokens)).catch((error) => {
      logger.error('[TokenProcessingStore] Failed to persist paused pending token', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  },

  consumePendingToken: () => {
    const { pendingToken, processingToken } = get();
    if (processingToken) {
      logger.debug('[TokenProcessingStore] Token already processing');
      return null;
    }
    if (pendingToken) {
      logger.debug('[TokenProcessingStore] Consuming pending token');
      set({
        pendingToken: null,
        processingToken: pendingToken,
      });
      return pendingToken;
    }
    return null;
  },

  hydratePendingToken: async () => {
    const { pendingToken, processingToken } = get();
    if (pendingToken) {
      return pendingToken;
    }
    if (processingToken) {
      return processingToken;
    }

    try {
      const { pendingTokens, pausedTokens } = await loadPersistedTokenQueues();
      if (pendingTokens.length > 0 || pausedTokens.length > 0) {
        logger.debug('[TokenProcessingStore] Hydrated persisted token queues', {
          pausedCount: pausedTokens.length,
          pendingCount: pendingTokens.length,
        });
        const [nextToken, ...queue] = pendingTokens;
        set({
          pendingToken: nextToken ?? null,
          pendingTokenQueue: queue,
          processingToken: null,
          pausedTokenQueue: pausedTokens,
        });
        return nextToken ?? null;
      }
    } catch (error) {
      logger.error('[TokenProcessingStore] Failed to hydrate pending token', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return null;
  },

  markTokenProcessed: async (token: string) => {
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, token);
    logger.debug('[TokenProcessingStore] Marking token as processed', {
      hash: hash.substring(0, 8),
    });
    set((state) => {
      const hashes = [...state.processedTokenHashes, hash];
      // Evict oldest half when exceeding max to prevent unbounded growth
      const trimmed =
        hashes.length > MAX_PROCESSED_HASHES
          ? hashes.slice(hashes.length - Math.floor(MAX_PROCESSED_HASHES / 2))
          : hashes;
      return { processedTokenHashes: new Set(trimmed) };
    });
  },

  isTokenProcessed: async (token: string) => {
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, token);
    const isProcessed = get().processedTokenHashes.has(hash);
    logger.debug('[TokenProcessingStore] Checking if token processed', {
      hash: hash.substring(0, 8),
      isProcessed,
    });
    return isProcessed;
  },

  registerTokenCheckCallback: (callback: () => void) => {
    logger.debug('[TokenProcessingStore] Registering token check callback');
    set({ tokenCheckCallback: callback });
  },

  unregisterTokenCheckCallback: () => {
    logger.debug('[TokenProcessingStore] Unregistering token check callback');
    clearTokenCheckTimer();
    set({ tokenCheckCallback: null });
  },

  triggerTokenCheck: () => {
    const { tokenCheckCallback } = get();
    if (tokenCheckCallback) {
      logger.debug('[TokenProcessingStore] Triggering token check');
      // Small delay to ensure state is updated
      clearTokenCheckTimer();
      tokenCheckTimer = setTimeout(() => {
        tokenCheckTimer = null;
        get().tokenCheckCallback?.();
      }, 50);
      (tokenCheckTimer as { unref?: () => void }).unref?.();
    }
  },

  registerWalletReloadCallback: (callback: () => void) => {
    logger.debug('[TokenProcessingStore] Registering wallet reload callback');
    set({ walletReloadCallback: callback });
  },

  unregisterWalletReloadCallback: () => {
    logger.debug('[TokenProcessingStore] Unregistering wallet reload callback');
    set({ walletReloadCallback: null });
  },

  triggerWalletReload: () => {
    const { walletReloadCallback } = get();
    if (walletReloadCallback) {
      logger.debug('[TokenProcessingStore] Triggering wallet reload');
      walletReloadCallback();
    }
  },

  reset: () => {
    logger.debug('[TokenProcessingStore] Resetting state');
    clearTokenCheckTimer();
    set(initialState);
    Promise.resolve(persistPendingTokens([])).catch((error) => {
      logger.error('[TokenProcessingStore] Failed to clear persisted pending token during reset', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  },
}));

// Selectors for optimal re-rendering
export const selectPendingToken = (state: TokenProcessingStore) => state.pendingToken;
