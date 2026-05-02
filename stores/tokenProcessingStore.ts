/**
 * Token Processing Store (Zustand)
 * Replaces global variables for cashu token processing
 * Provides type-safe state management for pending tokens
 */

import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
import { logger } from '../utils/logger';

// Max entries before evicting oldest half
const MAX_PROCESSED_HASHES = 1000;

interface TokenProcessingState {
  // Pending token to be processed
  pendingToken: string | null;
  // Set of processed token hashes (to prevent double-processing)
  processedTokenHashes: Set<string>;
  // Callback to trigger token check
  tokenCheckCallback: (() => void) | null;
  // Callback to reload wallet UI
  walletReloadCallback: (() => void) | null;
}

interface TokenProcessingActions {
  // Set a pending token for processing
  setPendingToken: (token: string) => void;
  // Clear the pending token (after processing)
  clearPendingToken: () => void;
  // Get and clear pending token atomically
  consumePendingToken: () => string | null;
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

export const useTokenProcessingStore = create<TokenProcessingStore>((set, get) => ({
  ...initialState,

  setPendingToken: (token: string) => {
    logger.debug('[TokenProcessingStore] Setting pending token');
    set({ pendingToken: token });
  },

  clearPendingToken: () => {
    logger.debug('[TokenProcessingStore] Clearing pending token');
    set({ pendingToken: null });
  },

  consumePendingToken: () => {
    const { pendingToken } = get();
    if (pendingToken) {
      logger.debug('[TokenProcessingStore] Consuming pending token');
      set({ pendingToken: null });
      return pendingToken;
    }
    return null;
  },

  markTokenProcessed: async (token: string) => {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      token
    );
    logger.debug('[TokenProcessingStore] Marking token as processed', { hash: hash.substring(0, 8) });
    set((state) => {
      const hashes = [...state.processedTokenHashes, hash];
      // Evict oldest half when exceeding max to prevent unbounded growth
      const trimmed = hashes.length > MAX_PROCESSED_HASHES
        ? hashes.slice(hashes.length - Math.floor(MAX_PROCESSED_HASHES / 2))
        : hashes;
      return { processedTokenHashes: new Set(trimmed) };
    });
  },

  isTokenProcessed: async (token: string) => {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      token
    );
    const isProcessed = get().processedTokenHashes.has(hash);
    logger.debug('[TokenProcessingStore] Checking if token processed', {
      hash: hash.substring(0, 8),
      isProcessed
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
  },
}));

// Selectors for optimal re-rendering
export const selectPendingToken = (state: TokenProcessingStore) => state.pendingToken;
