/**
 * Cashu Locked Tokens Service
 * Manages storage and retrieval of sent P2PK locked tokens
 */

import * as SecureStore from 'expo-secure-store';
import { logger } from '../../utils/logger';

const SENT_TOKENS_KEY = 'sent_spectre_tokens';
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

    // Filter by taproot address if provided
    const filteredTokens = taprootAddress
      ? tokens.filter(t => t.taprootAddress === taprootAddress)
      : tokens;

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
export const generateSpectreDeeplink = async (token, recipient, amount) => {
  console.log('[SpectreDeeplink] Generating deeplink with token:', token.substring(0, 50) + '...');
  console.log('[SpectreDeeplink] Token starts with:', token.substring(0, 10));

  // Try to shorten using Ducat server first
  try {
    const { shortenCashuToken } = await import('../urlShortener');
    const shortUrl = await shortenCashuToken(token);
    console.log('[SpectreDeeplink] Shortened URL from Ducat server:', shortUrl);
    return shortUrl;
  } catch (error) {
    console.error('[SpectreDeeplink] Failed to shorten with Ducat server:', error);
    console.log('[SpectreDeeplink] Falling back to ducat:// deeplink');

    // Fallback: Create ducat:// deeplink with the token directly
    // Cashu tokens are already URL-safe (alphanumeric + base64 characters)
    // No need to base64-encode again - just use the token as-is
    const fullDeeplink = `ducat://spectre/${token}`;
    console.log('[SpectreDeeplink] Full deeplink:', fullDeeplink.substring(0, 50) + '...');
    console.log('[SpectreDeeplink] Full deeplink length:', fullDeeplink.length);

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
export const generateSpectreQRData = async (token, recipient, amount) => {
  return await generateSpectreDeeplink(token, recipient, amount);
};
