/**
 * Cashu Locked Tokens Service
 * Manages storage and retrieval of sent P2PK locked tokens
 */

import * as SecureStore from 'expo-secure-store';
import { logger } from '../../utils/logger';
import { DEVICE_ONLY } from '../storagePolicy';
import { DEFAULT_CASHU_UNIT, type CashuUnit } from './cashuUnits';

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
  claimedAt?: number | null;
  partiallySpent?: boolean;
  unit?: CashuUnit;
}

export interface TokenRecord extends BaseTokenRecord {
  recipient: string;
  txid: string | null;
  shortUrl: string | null;
}

export interface ReceivedTokenRecord extends BaseTokenRecord {
  sender: string;
  type: string;
}

/** Union type for any ecash token (sent or received) */
export type EcashTokenRecord = TokenRecord | ReceivedTokenRecord;

const tokenTimestamp = (token: Pick<BaseTokenRecord, 'timestamp'>): number =>
  Number.isFinite(token.timestamp) ? token.timestamp : 0;

const limitStoredTokens = <T extends BaseTokenRecord>(tokens: T[]): T[] =>
  [...tokens]
    .sort((a, b) => tokenTimestamp(a) - tokenTimestamp(b))
    .slice(-MAX_STORED_TOKENS);

const limitStoredSentTokens = (tokens: TokenRecord[]): TokenRecord[] => {
  const activeTokens = tokens.filter((token) => token.claimed !== true);
  const claimedTokens = tokens.filter((token) => token.claimed === true);
  const claimedSlots = Math.max(0, MAX_STORED_TOKENS - activeTokens.length);
  const keptClaimedTokens = claimedSlots > 0 ? limitStoredTokens(claimedTokens).slice(-claimedSlots) : [];

  return [...activeTokens, ...keptClaimedTokens]
    .sort((a, b) => tokenTimestamp(a) - tokenTimestamp(b));
};

const sortTokensNewestFirst = <T extends BaseTokenRecord>(tokens: T[]): T[] =>
  [...tokens].sort((a, b) => tokenTimestamp(b) - tokenTimestamp(a));

const quarantineCorruptTokenStorage = async (
  storageKey: string,
  stored: string,
  reason: string
): Promise<void> => {
  const quarantineKey = `${storageKey}_corrupt_${Date.now()}`;
  try {
    await SecureStore.setItemAsync(quarantineKey, stored, DEVICE_ONLY);
    logger.warn('Quarantined corrupt Cashu token storage', {
      storageKey,
      quarantineKey,
      reason,
    });
  } catch (error) {
    logger.error('Failed to quarantine corrupt Cashu token storage', {
      storageKey,
      reason,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const loadTokenRecords = async <T extends BaseTokenRecord>(
  storageKey: string,
  label: string
): Promise<T[]> => {
  const tokensJson = await SecureStore.getItemAsync(storageKey);
  if (!tokensJson) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(tokensJson);
  } catch (error) {
    await quarantineCorruptTokenStorage(storageKey, tokensJson, 'invalid JSON');
    throw new Error(`${label} token storage corrupted: invalid JSON`);
  }

  if (!Array.isArray(parsed)) {
    await quarantineCorruptTokenStorage(storageKey, tokensJson, 'invalid token list');
    throw new Error(`${label} token storage corrupted: invalid token list`);
  }

  return parsed as T[];
};

const loadTokenRecordsForDisplay = async <T extends BaseTokenRecord>(
  storageKey: string,
  label: string
): Promise<T[]> => {
  try {
    return await loadTokenRecords<T>(storageKey, label);
  } catch (error) {
    logger.error(`Failed to get ${label} locked tokens`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
};

/**
 * Save a sent locked token with metadata
 */
export const saveSentLockedToken = async (
  token: string,
  recipient: string,
  amount: number,
  txid: string | null = null,
  shortUrl: string | null = null,
  taprootAddress: string | null = null,
  unit: CashuUnit = DEFAULT_CASHU_UNIT
): Promise<void> => {
  try {
    logger.info('Saving sent locked token', {
      recipient,
      amount,
      txid,
      hasShortUrl: Boolean(shortUrl),
      taprootAddress,
      unit,
    });

    // Load existing tokens strictly so corrupt history is not overwritten.
    const existingTokens = await loadTokenRecords<TokenRecord>(SENT_TOKENS_KEY, 'sent');

    // Add new token with metadata
    const tokenRecord: TokenRecord = {
      token,
      recipient,
      amount,
      timestamp: Date.now(),
      txid,
      shortUrl, // Store shortened URL if available
      taprootAddress, // Associate with account
      unit,
      id: `${recipient}_${Date.now()}`, // Unique ID
    };

    const existingIndex = existingTokens.findIndex((existing) => existing.token === token);
    if (existingIndex >= 0) {
      const existing = existingTokens[existingIndex];
      existingTokens[existingIndex] = {
        ...existing,
        recipient,
        amount,
        txid: txid ?? existing.txid ?? null,
        shortUrl: shortUrl ?? existing.shortUrl ?? null,
        taprootAddress: taprootAddress ?? existing.taprootAddress ?? null,
        unit: unit ?? existing.unit ?? DEFAULT_CASHU_UNIT,
        timestamp: existing.timestamp,
        id: existing.id,
      };
    } else {
      existingTokens.push(tokenRecord);
    }

    // Keep only last MAX_STORED_TOKENS to prevent storage bloat
    const tokensToStore = limitStoredSentTokens(existingTokens);

    await SecureStore.setItemAsync(SENT_TOKENS_KEY, JSON.stringify(tokensToStore), DEVICE_ONLY);

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
    const tokens = await loadTokenRecordsForDisplay<TokenRecord>(SENT_TOKENS_KEY, 'sent');

    logger.info('Getting sent locked tokens', {
      totalTokens: tokens.length,
      requestedAddress: taprootAddress,
      tokenAddresses: tokens.map(t => ({ id: t.id, address: t.taprootAddress }))
    });

    // Filter by taproot address if provided.
    // Only include tokens that have a matching taprootAddress.
    const filteredTokens = taprootAddress
      ? tokens.filter(t => t.taprootAddress && t.taprootAddress === taprootAddress)
      : tokens;

    logger.info('Filtered tokens', {
      filteredCount: filteredTokens.length,
      requestedAddress: taprootAddress
    });

    // Sort by timestamp descending (newest first)
    return sortTokensNewestFirst(filteredTokens);
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

    const tokens = await loadTokenRecords<TokenRecord>(SENT_TOKENS_KEY, 'sent');
    const filteredTokens = tokens.filter(t => t.id !== tokenId);

    await SecureStore.setItemAsync(SENT_TOKENS_KEY, JSON.stringify(filteredTokens), DEVICE_ONLY);

    logger.info('Sent locked token deleted', { remaining: filteredTokens.length });
  } catch (error: unknown) {
    logger.error('Failed to delete sent locked token', { error: (error as Error).message });
    throw error;
  }
};

/**
 * Update the claimed status of a token
 */
export const updateTokenClaimedStatus = async (
  tokenId: string,
  claimed: boolean,
  tokenKind: 'sent' | 'received' = 'sent'
): Promise<void> => {
  try {
    logger.info('Updating token claimed status', { tokenId, claimed, tokenKind });

    const storageKey = tokenKind === 'received' ? RECEIVED_TOKENS_KEY : SENT_TOKENS_KEY;
    const tokens = await loadTokenRecords<EcashTokenRecord>(
      storageKey,
      tokenKind === 'received' ? 'received' : 'sent'
    );
    const updatedTokens = tokens.map(t => {
      if (t.id === tokenId) {
        return { ...t, claimed, claimedAt: claimed ? Date.now() : null };
      }
      return t;
    });

    await SecureStore.setItemAsync(storageKey, JSON.stringify(updatedTokens), DEVICE_ONLY);

    logger.info('Token claimed status updated', { tokenId, claimed, tokenKind });
    notifyTokenChange();
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
    logger.info('Clearing claimed sent locked token history');
    const tokens = await loadTokenRecords<TokenRecord>(SENT_TOKENS_KEY, 'sent');
    const activeTokens = tokens.filter((token) => token.claimed !== true);
    await SecureStore.setItemAsync(SENT_TOKENS_KEY, JSON.stringify(activeTokens), DEVICE_ONLY);
    logger.info('Claimed sent locked token history cleared', {
      removed: tokens.length - activeTokens.length,
      activePreserved: activeTokens.length,
    });
    notifyTokenChange();
  } catch (error: unknown) {
    logger.error('Failed to clear sent locked tokens', { error: (error as Error).message });
    throw error;
  }
};

export const clearReceivedTokensHistory = async (): Promise<void> => {
  try {
    logger.info('Clearing received token history');
    await SecureStore.setItemAsync(RECEIVED_TOKENS_KEY, JSON.stringify([]), DEVICE_ONLY);
    notifyTokenChange();
  } catch (error: unknown) {
    logger.error('Failed to clear received token history', { error: (error as Error).message });
    throw error;
  }
};

export const clearLockedTokensHistory = async (): Promise<void> => {
  await clearSentLockedTokens();
  await clearReceivedTokensHistory();
};

/**
 * Generate deeplink URL for a locked token with base64-encoded token
 * Returns the ducat:// deeplink directly without shortening
 */
export const generateTurboDeeplink = async (token: string, _recipient: string, _amount: number): Promise<string> => {
  logger.debug('[TurboDeeplink] Generating deeplink for locked token', { tokenLength: token.length });

  // Try to shorten using Ducat server first
  try {
    const { shortenCashuToken } = await import('../urlShortener');
    const shortUrl = await shortenCashuToken(token);
    logger.debug('[TurboDeeplink] Shortened URL from Ducat server', { shortUrlLength: shortUrl.length });
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
  taprootAddress: string,
  unit: CashuUnit = DEFAULT_CASHU_UNIT
): Promise<void> => {
  try {
    logger.info('Saving received token', { sender, amount, taprootAddress, unit });

    // Load existing tokens strictly so corrupt history is not overwritten.
    const existingTokens = await loadTokenRecords<ReceivedTokenRecord>(RECEIVED_TOKENS_KEY, 'received');

    const existingIndex = existingTokens.findIndex((existing) => existing.token === token);
    if (existingIndex >= 0) {
      const existing = existingTokens[existingIndex];
      existingTokens[existingIndex] = {
        ...existing,
        sender: sender || existing.sender || 'Unknown',
        amount,
        taprootAddress: taprootAddress || existing.taprootAddress || null,
        unit,
        type: existing.type || 'receive',
      };
    } else {
      // Add new token with metadata
      const tokenRecord: ReceivedTokenRecord = {
        token,
        sender: sender || 'Unknown',
        amount,
        timestamp: Date.now(),
        taprootAddress, // Associate with account
        unit,
        id: `received_${Date.now()}`, // Unique ID
        type: 'receive', // Transaction type
      };

      existingTokens.push(tokenRecord);
    }

    // Keep only last MAX_STORED_TOKENS to prevent storage bloat
    const tokensToStore = limitStoredTokens(existingTokens);

    await SecureStore.setItemAsync(RECEIVED_TOKENS_KEY, JSON.stringify(tokensToStore), DEVICE_ONLY);

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
    const tokens = await loadTokenRecordsForDisplay<ReceivedTokenRecord>(RECEIVED_TOKENS_KEY, 'received');

    // Filter by account if taprootAddress provided
    const filteredTokens = taprootAddress
      ? tokens.filter(t => t.taprootAddress === taprootAddress)
      : tokens;

    return sortTokensNewestFirst(filteredTokens);
  } catch (error: unknown) {
    logger.error('Failed to get received tokens', { error: (error as Error).message });
    return [];
  }
};
