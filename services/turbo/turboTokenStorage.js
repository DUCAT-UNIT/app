/**
 * Turbo Token Storage
 * Handles persistent storage and deduplication of processed Cashu tokens
 */

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { logger } from '../../utils/logger';

// Storage key for processed tokens
const PROCESSED_TOKENS_KEY = 'processed_cashu_tokens';
const MAX_STORED_TOKENS = 500; // Store up to 500 processed token hashes

/**
 * Hash a token for storage (SHA256)
 */
export const hashToken = async (token) => {
  try {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      token
    );
    return hash;
  } catch (error) {
    logger.error('[TURBO] Failed to hash token:', { message: error.message });
    // Fallback to storing first 64 chars if hashing fails
    return token.substring(0, 64);
  }
};

/**
 * Load processed tokens from persistent storage
 */
export const loadProcessedTokens = async () => {
  try {
    const stored = await SecureStore.getItemAsync(PROCESSED_TOKENS_KEY);
    if (stored) {
      const tokens = JSON.parse(stored);
      return new Set(tokens);
    }
  } catch (error) {
    logger.error('[TURBO] Failed to load processed tokens:', { message: error.message });
  }
  return new Set();
};

/**
 * Save processed tokens to persistent storage
 */
export const saveProcessedTokens = async (tokensSet) => {
  try {
    // Convert Set to Array and limit size
    const tokensArray = Array.from(tokensSet).slice(-MAX_STORED_TOKENS);
    await SecureStore.setItemAsync(PROCESSED_TOKENS_KEY, JSON.stringify(tokensArray));
    logger.debug('[TURBO] Saved processed tokens to storage:', tokensArray.length);
  } catch (error) {
    logger.error('[TURBO] Failed to save processed tokens:', { message: error.message });
  }
};

/**
 * Mark a token as processed
 */
export const markTokenAsProcessed = async (token) => {
  try {
    const tokenHash = await hashToken(token);
    if (global.processedCashuTokens) {
      global.processedCashuTokens.add(tokenHash);
      logger.debug('[TURBO] Marked token as processed. Total:', global.processedCashuTokens.size);
      await saveProcessedTokens(global.processedCashuTokens);
    }
  } catch (error) {
    logger.error('[TURBO] Failed to mark token as processed:', { message: error.message });
  }
};

/**
 * Check if a token has already been processed
 */
export const isTokenProcessed = async (token) => {
  try {
    const tokenHash = await hashToken(token);
    return global.processedCashuTokens && global.processedCashuTokens.has(tokenHash);
  } catch (error) {
    logger.error('[TURBO] Failed to check token status:', { message: error.message });
    return false;
  }
};

/**
 * Initialize token storage on app start
 */
export const initializeTokenStorage = async () => {
  if (typeof global !== 'undefined' && !global.processedCashuTokens) {
    global.processedCashuTokensLoading = true;

    try {
      const tokensSet = await loadProcessedTokens();
      global.processedCashuTokens = tokensSet;
      global.processedCashuTokensLoading = false;
      logger.debug('[TURBO] Loaded processed tokens from storage:', tokensSet.size);
    } catch (error) {
      logger.error('[TURBO] Failed to load processed tokens, starting fresh:', { message: error.message });
      global.processedCashuTokens = new Set();
      global.processedCashuTokensLoading = false;
    }
  }
};
