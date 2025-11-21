/**
 * Cashu Locked Tokens Service
 * Manages storage and retrieval of sent P2PK locked tokens
 */

import * as SecureStore from 'expo-secure-store';
import { logger } from '../../utils/logger';
import { encodeCashuToken } from '../../utils/emojiEncoder';
import { createSpectreShortUrl } from '../urlShortener';

const SENT_TOKENS_KEY = 'sent_spectre_tokens';
const MAX_STORED_TOKENS = 100; // Increased from 50

/**
 * Save a sent locked token with metadata
 * @param {string} token - Encoded Cashu token
 * @param {string} recipient - Recipient taproot address
 * @param {number} amount - Amount in smallest units
 * @param {string} txid - Optional transaction ID
 * @returns {Promise<void>}
 */
export const saveSentLockedToken = async (token, recipient, amount, txid = null) => {
  try {
    logger.info('Saving sent locked token', { recipient, amount, txid });

    // Load existing tokens
    const existingTokens = await getSentLockedTokens();

    // Add new token with metadata
    const tokenRecord = {
      token,
      recipient,
      amount,
      timestamp: Date.now(),
      txid,
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
 * Get all sent locked tokens
 * @returns {Promise<Array>} Array of token records
 */
export const getSentLockedTokens = async () => {
  try {
    const tokensJson = await SecureStore.getItemAsync(SENT_TOKENS_KEY);
    if (!tokensJson) {
      return [];
    }

    const tokens = JSON.parse(tokensJson);

    // Sort by timestamp descending (newest first)
    return tokens.sort((a, b) => b.timestamp - a.timestamp);
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
 * Returns a promise that resolves to shortened URL via Rebrandly
 * @param {string} token - Encoded Cashu token
 * @param {string} recipient - Recipient taproot address
 * @param {number} amount - Amount in smallest units
 * @returns {Promise<string>} Shortened deeplink URL
 */
export const generateSpectreDeeplink = async (token, recipient, amount) => {
  console.log('[SpectreDeeplink] Generating deeplink with token:', token.substring(0, 50) + '...');
  console.log('[SpectreDeeplink] Token starts with:', token.substring(0, 10));

  // Base64 encode the cashu token for URL safety
  // Use URL-safe base64: replace + with -, / with _, and remove padding =
  const base64Token = btoa(token)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  console.log('[SpectreDeeplink] URL-safe base64 token length:', base64Token.length);

  // Convert amount from smallest units to display units (for slashtag)
  const displayAmount = amount / 100;

  // Create a minimal destination URL (just a placeholder)
  // The actual token will be in the URL fragment (after #) which Rebrandly doesn't count toward the 2048 limit
  const destinationUrl = `https://ducatprotocol.com/unit`;

  // Create full deeplink with token in fragment
  // Fragment is NOT sent to the server, only processed client-side
  const fullDeeplink = `${destinationUrl}#${base64Token}`;
  console.log('[SpectreDeeplink] Full deeplink length:', fullDeeplink.length);

  // Shorten URL with Rebrandly (pass address and amount for slashtag)
  const shortUrl = await createSpectreShortUrl(fullDeeplink, recipient, displayAmount, base64Token);
  console.log('[SpectreDeeplink] Short URL:', shortUrl);

  return shortUrl;
};

/**
 * Generate QR code data for a locked token
 * @param {string} token - Encoded Cashu token
 * @param {string} recipient - Recipient taproot address
 * @param {number} amount - Amount in smallest units
 * @returns {string} QR code data (deeplink URL)
 */
export const generateSpectreQRData = (token, recipient, amount) => {
  return generateSpectreDeeplink(token, recipient, amount);
};
