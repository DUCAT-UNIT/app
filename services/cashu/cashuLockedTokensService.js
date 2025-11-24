/**
 * Cashu Locked Tokens Service
 * Manages storage and retrieval of sent P2PK locked tokens
 */

import * as SecureStore from 'expo-secure-store';
import { logger } from '../../utils/logger';

const SENT_TOKENS_KEY = 'sent_turbo_tokens';
const RECEIVED_TOKENS_KEY = 'received_turbo_tokens';
const MAX_STORED_TOKENS = 100; // Increased from 50

/**
 * Save a sent locked token with metadata
 * @param {string} token - Encoded Cashu token
 * @param {string} recipient - Recipient taproot address
 * @param {number} amount - Amount in smallest units
 * @param {string} txid - Optional transaction ID
 * @param {string} shortUrl - Optional shortened URL
 * @param {string} taprootAddress - Sender's taproot address (for account association)
 * @returns {Promise<void>}
 */
export const saveSentLockedToken = async (token, recipient, amount, txid = null, shortUrl = null, taprootAddress = null) => {
  try {
    logger.info('Saving sent locked token', { recipient, amount, txid, shortUrl, taprootAddress });

    // Load existing tokens
    const existingTokens = await getSentLockedTokens();

    // Add new token with metadata
    const tokenRecord = {
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
  } catch (error) {
    logger.error('Failed to save sent locked token', { error: error.message });
    throw error;
  }
};

/**
 * Get all sent locked tokens for a specific account
 * @param {string} taprootAddress - Optional taproot address to filter by account
 * @returns {Promise<Array>} Array of token records
 */
export const getSentLockedTokens = async (taprootAddress = null) => {
  try {
    const tokensJson = await SecureStore.getItemAsync(SENT_TOKENS_KEY);
    if (!tokensJson) {
      return [];
    }

    const tokens = JSON.parse(tokensJson);

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
  } catch (error) {
    logger.error('Failed to get sent locked tokens', { error: error.message });
    return [];
  }
};

/**
 * Delete a sent locked token by ID
 * @param {string} tokenId - Token record ID
 * @returns {Promise<void>}
 */
export const deleteSentLockedToken = async (tokenId) => {
  try {
    logger.info('Deleting sent locked token', { tokenId });

    const tokens = await getSentLockedTokens();
    const filteredTokens = tokens.filter(t => t.id !== tokenId);

    await SecureStore.setItemAsync(SENT_TOKENS_KEY, JSON.stringify(filteredTokens));

    logger.info('Sent locked token deleted', { remaining: filteredTokens.length });
  } catch (error) {
    logger.error('Failed to delete sent locked token', { error: error.message });
    throw error;
  }
};

/**
 * Update the claimed status of a token
 * @param {string} tokenId - Token record ID
 * @param {boolean} claimed - Whether the token has been claimed
 * @returns {Promise<void>}
 */
export const updateTokenClaimedStatus = async (tokenId, claimed) => {
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
  } catch (error) {
    logger.error('Failed to update token claimed status', { error: error.message });
    throw error;
  }
};

/**
 * Clear all sent locked tokens
 * @returns {Promise<void>}
 */
export const clearSentLockedTokens = async () => {
  try {
    logger.info('Clearing all sent locked tokens');
    await SecureStore.deleteItemAsync(SENT_TOKENS_KEY);
    logger.info('All sent locked tokens cleared');
  } catch (error) {
    logger.error('Failed to clear sent locked tokens', { error: error.message });
    throw error;
  }
};

/**
 * Generate deeplink URL for a locked token with base64-encoded token
 * Returns the ducat:// deeplink directly without shortening
 * @param {string} token - Encoded Cashu token
 * @param {string} recipient - Recipient taproot address (unused, kept for compatibility)
 * @param {number} amount - Amount in smallest units (unused, kept for compatibility)
 * @returns {string} ducat:// deeplink URL
 */
export const generateTurboDeeplink = async (token, recipient, amount) => {
  console.log('[TurboDeeplink] Generating deeplink with token:', token.substring(0, 50) + '...');
  console.log('[TurboDeeplink] Token starts with:', token.substring(0, 10));

  // Try to shorten using Ducat server first
  try {
    const { shortenCashuToken } = await import('../urlShortener');
    const shortUrl = await shortenCashuToken(token);
    console.log('[TurboDeeplink] Shortened URL from Ducat server:', shortUrl);
    return shortUrl;
  } catch (error) {
    console.error('[TurboDeeplink] Failed to shorten with Ducat server:', error);
    console.log('[TurboDeeplink] Falling back to ducat:// deeplink');

    // Fallback: Create ducat:// deeplink with the token directly
    // Cashu tokens are already URL-safe (alphanumeric + base64 characters)
    // No need to base64-encode again - just use the token as-is
    const fullDeeplink = `ducat://turbo/${token}`;
    console.log('[TurboDeeplink] Full deeplink:', fullDeeplink.substring(0, 50) + '...');
    console.log('[TurboDeeplink] Full deeplink length:', fullDeeplink.length);

    return fullDeeplink;
  }
};

/**
 * Generate QR code data for a locked token
 * @param {string} token - Encoded Cashu token
 * @param {string} recipient - Recipient taproot address
 * @param {number} amount - Amount in smallest units
 * @returns {string} QR code data (deeplink URL)
 */
export const generateTurboQRData = async (token, recipient, amount) => {
  return await generateTurboDeeplink(token, recipient, amount);
};

/**
 * Save a received/claimed token with metadata for transaction history
 * @param {string} token - Encoded Cashu token
 * @param {string} sender - Sender information (if known)
 * @param {number} amount - Amount in smallest units
 * @param {string} taprootAddress - Receiver's taproot address (for account association)
 * @returns {Promise<void>}
 */
export const saveReceivedToken = async (token, sender, amount, taprootAddress) => {
  try {
    logger.info('Saving received token', { sender, amount, taprootAddress });

    // Load existing tokens
    const existingTokens = await getReceivedTokens();

    // Add new token with metadata
    const tokenRecord = {
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
  } catch (error) {
    logger.error('Failed to save received token', { error: error.message });
    throw error;
  }
};

/**
 * Get all received tokens for a specific account
 * @param {string} taprootAddress - Optional taproot address to filter by account
 * @returns {Promise<Array>} Array of token records
 */
export const getReceivedTokens = async (taprootAddress = null) => {
  try {
    const tokensJson = await SecureStore.getItemAsync(RECEIVED_TOKENS_KEY);
    if (!tokensJson) {
      return [];
    }

    const tokens = JSON.parse(tokensJson);

    // Filter by account if taprootAddress provided
    if (taprootAddress) {
      return tokens.filter(t => t.taprootAddress === taprootAddress);
    }

    return tokens;
  } catch (error) {
    logger.error('Failed to get received tokens', { error: error.message });
    return [];
  }
};
