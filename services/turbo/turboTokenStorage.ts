/**
 * Turbo Token Storage
 * Handles persistent storage and deduplication of processed Cashu tokens
 */

import * as Crypto from 'expo-crypto';
import { logger } from '../../utils/logger';
import { getPreferenceItem, setPreferenceItem } from '../storagePolicy';

/**
 * Snackbar display params for turbo notifications
 */
interface TurboSnackbarParams {
  message: string;
  type: string;
}

/**
 * Global state extensions for turbo token tracking
 */
interface TurboGlobalState {
  processedCashuTokens?: Set<string>;
  processedCashuTokensLoading?: boolean;
  pendingCashuToken?: string;
  pendingTurboSnackbars?: TurboSnackbarParams[];
  turboJustResumed?: boolean;
}

// Type-safe global accessor
const turboGlobal = global as typeof globalThis & TurboGlobalState;

// Storage key for processed tokens
const PROCESSED_TOKENS_KEY = 'processed_cashu_tokens';
const MAX_STORED_TOKENS = 500; // Store up to 500 processed token hashes

/**
 * Hash a token for storage (SHA256)
 */
export const hashToken = async (token: string): Promise<string> => {
  try {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      token
    );
    return hash;
  } catch (error: unknown) {
    logger.error('[TURBO] Failed to hash token:', { message: (error as Error).message });
    throw new Error('Failed to hash Cashu token for deduplication');
  }
};

/**
 * Load processed tokens from persistent storage
 */
export const loadProcessedTokens = async (): Promise<Set<string>> => {
  try {
    const stored = await getPreferenceItem(PROCESSED_TOKENS_KEY);
    if (stored) {
      const tokens = JSON.parse(stored) as string[];
      return new Set(tokens);
    }
  } catch (error: unknown) {
    logger.error('[TURBO] Failed to load processed tokens:', { message: (error as Error).message });
  }
  return new Set();
};

/**
 * Save processed tokens to persistent storage
 */
export const saveProcessedTokens = async (tokensSet: Set<string>): Promise<void> => {
  try {
    // Convert Set to Array and limit size
    const tokensArray = Array.from(tokensSet).slice(-MAX_STORED_TOKENS);
    await setPreferenceItem(PROCESSED_TOKENS_KEY, JSON.stringify(tokensArray));
    logger.debug('[TURBO] Saved processed tokens to storage:', { count: tokensArray.length });
  } catch (error: unknown) {
    logger.error('[TURBO] Failed to save processed tokens:', { message: (error as Error).message });
  }
};

/**
 * Mark a token as processed
 */
export const markTokenAsProcessed = async (token: string): Promise<void> => {
  try {
    const tokenHash = await hashToken(token);
    if (turboGlobal.processedCashuTokens) {
      turboGlobal.processedCashuTokens.add(tokenHash);
      logger.debug('[TURBO] Marked token as processed. Total:', { count: turboGlobal.processedCashuTokens.size });
      await saveProcessedTokens(turboGlobal.processedCashuTokens);
    }
  } catch (error: unknown) {
    logger.error('[TURBO] Failed to mark token as processed:', { message: (error as Error).message });
  }
};

/**
 * Check if a token has already been processed
 */
export const isTokenProcessed = async (token: string): Promise<boolean> => {
  try {
    const tokenHash = await hashToken(token);
    return turboGlobal.processedCashuTokens?.has(tokenHash) ?? false;
  } catch (error: unknown) {
    logger.error('[TURBO] Failed to check token status:', { message: (error as Error).message });
    return false;
  }
};

/**
 * Initialize token storage on app start
 */
export const initializeTokenStorage = async (): Promise<void> => {
  if (typeof global !== 'undefined' && !turboGlobal.processedCashuTokens) {
    turboGlobal.processedCashuTokensLoading = true;

    try {
      const tokensSet = await loadProcessedTokens();
      turboGlobal.processedCashuTokens = tokensSet;
      turboGlobal.processedCashuTokensLoading = false;
      logger.debug('[TURBO] Loaded processed tokens from storage:', { count: tokensSet.size });
    } catch (error: unknown) {
      logger.error('[TURBO] Failed to load processed tokens, starting fresh:', { message: (error as Error).message });
      turboGlobal.processedCashuTokens = new Set();
      turboGlobal.processedCashuTokensLoading = false;
    }
  }
};

// Export turboGlobal and types for use in other turbo modules
export { turboGlobal };
export type { TurboGlobalState, TurboSnackbarParams };
