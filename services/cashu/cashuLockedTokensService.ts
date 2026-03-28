/**
 * Cashu Locked Tokens Service
 * Manages storage and retrieval of sent P2PK locked tokens
 */

import * as SecureStore from 'expo-secure-store';
import { logger } from '../../utils/logger';

const SENT_TOKENS_KEY = 'sent_turbo_tokens';
const RECEIVED_TOKENS_KEY = 'received_turbo_tokens';
const MAX_STORED_TOKENS = 100; // Increased from 50

// Simple event emitter for token changes
type TokenChangeListener = () => void;
const tokenChangeListeners: Set<TokenChangeListener> = new Set();

/**
 * Subscribe to token changes (sent or received)
 * Returns unsubscribe function
 */
export const subscribeToTokenChanges = (listener: TokenChangeListener): (() => void) => {
  tokenChangeListeners.add(listener);
  return () => {
    tokenChangeListeners.delete(listener);
  };
};

/**
 * Notify all listeners that tokens have changed
 */
const notifyTokenChange = (): void => {
  tokenChangeListeners.forEach(listener => {
    try {
      listener();
    } catch (error) {
      logger.error('Error in token change listener', { error: (error as Error).message });
    }
  });
};

/** Base interface for token records (both sent and received) */
export interface BaseTokenRecord {
  token: string;
  amount: number;
  timestamp: number;
  taprootAddress: string | null;
  id: string;
  claimed?: boolean;
  partiallySpent?: boolean;
}

export interface TokenRecord extends BaseTokenRecord {
  recipient: string;
  txid: string | null;
  shortUrl: string | null;
  claimedAt?: number | null;
}

export interface ReceivedTokenRecord extends BaseTokenRecord {
  sender: string;
  type: string;
}

/** Union type for any ecash token (sent or received) */
export type EcashTokenRecord = TokenRecord | ReceivedTokenRecord;

/**
 * Save a sent locked token with metadata
 */
export const saveSentLockedToken = async (
  token: string,
  recipient: string,
  amount: number,
  txid: string | null = null,
  shortUrl: string | null = null,
  taprootAddress: string | null = null
): Promise<void> => {
  try {
    logger.info('Saving sent locked token', { recipient, amount, txid, shortUrl, taprootAddress });

    // Load existing tokens
    const existingTokens = await getSentLockedTokens();

    // Add new token with metadata
    const tokenRecord: TokenRecord = {
      token,
      recipient,
      amount,
      timestamp: Date.now(),
      txid,
      shortUrl, // Store shortened URL if available
      taprootAddress, // Associate with account
      id: `${recipient}_${Date.now()}`, // Unique ID
    };

    existingTokens.push(tokenRecord);

    // Keep only last MAX_STORED_TOKENS to prevent storage bloat
    const tokensToStore = existingTokens.slice(-MAX_STORED_TOKENS);

    await SecureStore.setItemAsync(SENT_TOKENS_KEY, JSON.stringify(tokensToStore));

    logger.info('Sent locked token saved', { totalStored: tokensToStore.length });

    // Notify listeners that tokens have changed
    notifyTokenChange();
  } catch (error: unknown) {
    logger.error('Failed to save sent locked token', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Get all sent locked tokens for a specific account
 */
export const getSentLockedTokens = async (taprootAddress: string | null = null): Promise<TokenRecord[]> => {
  try {
    const tokensJson = await SecureStore.getItemAsync(SENT_TOKENS_KEY);
    if (!tokensJson) {
      return [];
    }

    const tokens: TokenRecord[] = JSON.parse(tokensJson);

    logger.info('Getting sent locked tokens', {
      totalTokens: tokens.length,
      requestedAddress: taprootAddress,
      tokenAddresses: tokens.map(t => ({ id: t.id, address: t.taprootAddress }))
    });

    // Filter by taproot address if provided
    // Only include tokens that have a matching taprootAddress
    // Exclude tokens without taprootAddress (legacy tokens)
    const filteredTokens = taprootAddress
      ? tokens.filter(t => t.taprootAddress && t.taprootAddress === taprootAddress)
      : tokens;

    logger.info('Filtered tokens', {
      filteredCount: filteredTokens.length,
      requestedAddress: taprootAddress
    });

    // Sort by timestamp descending (newest first)
    return filteredTokens.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error: unknown) {
    logger.error('Failed to get sent locked tokens', { error: (error as Error).message });
    return [];
  }
};

/**
 * Delete a sent locked token by ID
 */
export const deleteSentLockedToken = async (tokenId: string): Promise<void> => {
  try {
    logger.info('Deleting sent locked token', { tokenId });

    const tokens = await getSentLockedTokens();
    const filteredTokens = tokens.filter(t => t.id !== tokenId);

    await SecureStore.setItemAsync(SENT_TOKENS_KEY, JSON.stringify(filteredTokens));

    logger.info('Sent locked token deleted', { remaining: filteredTokens.length });
  } catch (error: unknown) {
    logger.error('Failed to delete sent locked token', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Update the claimed status of a token
 */
export const updateTokenClaimedStatus = async (tokenId: string, claimed: boolean): Promise<void> => {
  try {
    logger.info('Updating token claimed status', { tokenId, claimed });

    const tokens = await getSentLockedTokens();
    const updatedTokens = tokens.map(t => {
      if (t.id === tokenId) {
        return { ...t, claimed, claimedAt: claimed ? Date.now() : null };
      }
      return t;
    });

    await SecureStore.setItemAsync(SENT_TOKENS_KEY, JSON.stringify(updatedTokens));

    logger.info('Token claimed status updated', { tokenId, claimed });
  } catch (error: unknown) {
    logger.error('Failed to update token claimed status', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Clear all sent locked tokens
 */
export const clearSentLockedTokens = async (): Promise<void> => {
  try {
    logger.info('Clearing all sent locked tokens');
    // Set to empty array instead of deleting — avoids errors if key doesn't exist
    await SecureStore.setItemAsync(SENT_TOKENS_KEY, '[]');
    logger.info('All sent locked tokens cleared');
  } catch (error: unknown) {
    logger.error('Failed to clear sent locked tokens', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Generate deeplink URL for a locked token with base64-encoded token
 * Returns the ducat:// deeplink directly without shortening
 */
export const generateTurboDeeplink = async (token: string, _recipient: string, _amount: number): Promise<string> => {
  logger.debug('[TurboDeeplink] Generating deeplink with token:', token.substring(0, 50) + '...');
  logger.debug('[TurboDeeplink] Token starts with:', token.substring(0, 10));

  // Try to shorten using Ducat server first
  try {
    const { shortenCashuToken } = await import('../urlShortener');
    const shortUrl = await shortenCashuToken(token);
    logger.debug('[TurboDeeplink] Shortened URL from Ducat server:', shortUrl);
    return shortUrl;
  } catch (error: unknown) {
    logger.error('[TurboDeeplink] Failed to shorten with Ducat server', { error });
    logger.debug('[TurboDeeplink] Falling back to ducat:// deeplink');

    // Fallback: Create ducat:// deeplink with the token directly
    // Cashu tokens are already URL-safe (alphanumeric + base64 characters)
    // No need to base64-encode again - just use the token as-is
    const fullDeeplink = `ducat://turbo/${token}`;
    logger.debug('[TurboDeeplink] Full deeplink:', fullDeeplink.substring(0, 50) + '...');
    logger.debug('[TurboDeeplink] Full deeplink length:', fullDeeplink.length);

    return fullDeeplink;
  }
};

/**
 * Generate QR code data for a locked token
 */
export const generateTurboQRData = async (token: string, recipient: string, amount: number): Promise<string> => {
  return await generateTurboDeeplink(token, recipient, amount);
};

/**
 * Save a received/claimed token with metadata for transaction history
 */
export const saveReceivedToken = async (
  token: string,
  sender: string,
  amount: number,
  taprootAddress: string
): Promise<void> => {
  try {
    logger.info('Saving received token', { sender, amount, taprootAddress });

    // Load existing tokens
    const existingTokens = await getReceivedTokens();

    // Add new token with metadata
    const tokenRecord: ReceivedTokenRecord = {
      token,
      sender: sender || 'Unknown',
      amount,
      timestamp: Date.now(),
      taprootAddress, // Associate with account
      id: `received_${Date.now()}`, // Unique ID
      type: 'receive', // Transaction type
    };

    existingTokens.push(tokenRecord);

    // Keep only last MAX_STORED_TOKENS to prevent storage bloat
    const tokensToStore = existingTokens.slice(-MAX_STORED_TOKENS);

    await SecureStore.setItemAsync(RECEIVED_TOKENS_KEY, JSON.stringify(tokensToStore));

    logger.info('Received token saved', { totalStored: tokensToStore.length });

    // Notify listeners that tokens have changed
    notifyTokenChange();
  } catch (error: unknown) {
    logger.error('Failed to save received token', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Get all received tokens for a specific account
 */
export const getReceivedTokens = async (taprootAddress: string | null = null): Promise<ReceivedTokenRecord[]> => {
  try {
    const tokensJson = await SecureStore.getItemAsync(RECEIVED_TOKENS_KEY);
    if (!tokensJson) {
      return [];
    }

    const tokens: ReceivedTokenRecord[] = JSON.parse(tokensJson);

    // Filter by account if taprootAddress provided
    if (taprootAddress) {
      return tokens.filter(t => t.taprootAddress === taprootAddress);
    }

    return tokens;
  } catch (error: unknown) {
    logger.error('Failed to get received tokens', { error: (error as Error).message });
    return [];
  }
};
