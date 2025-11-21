/**
 * Cashu Locked Tokens Service
 * Manages storage and retrieval of sent P2PK locked tokens
 */

import * as SecureStore from 'expo-secure-store';
import { logger } from '../../utils/logger';
import { encodeCashuToken } from '../../utils/emojiEncoder';

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
 * Generate deeplink URL for a locked token with emoji-encoded token
 * @param {string} token - Encoded Cashu token
 * @param {string} recipient - Recipient taproot address
 * @param {number} amount - Amount in smallest units
 * @returns {string} Deeplink URL with emoji-encoded token
 */
export const generateSpectreDeeplink = (token, recipient, amount) => {
  console.log('[SpectreDeeplink] Generating deeplink with token:', token.substring(0, 50) + '...');
  console.log('[SpectreDeeplink] Token starts with:', token.substring(0, 10));

  // Encode the cashu token as ghost emoji with variation selectors
  const emojiToken = encodeCashuToken(token);

  // Simple format: ducat://unit?👻
  // The 👻 emoji contains the entire token encoded in invisible variation selectors
  // No address or amount needed - everything is in the token
  const deeplink = `ducat://unit?${emojiToken}`;

  console.log('[SpectreDeeplink] Generated deeplink:', deeplink);
  console.log('[SpectreDeeplink] Ghost emoji token length:', emojiToken.length);

  return deeplink;
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
