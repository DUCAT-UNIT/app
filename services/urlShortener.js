/**
 * URL Shortener Service
 * Creates short URLs for Cashu tokens using Ducat server
 */

import { logger } from '../utils/logger';

/**
 * Shorten Cashu token using custom short.ducatprotocol.com server
 * @param {string} cashuToken - The Cashu token to shorten
 * @returns {Promise<string>} The shortened URL
 */
export const shortenCashuToken = async (cashuToken) => {
  try {
    logger.info('Shortening Cashu token with Ducat server', { tokenLength: cashuToken.length });

    const response = await fetch('https://short.ducatprotocol.com/api/shorten', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cashuToken }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ducat shortener error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (!result.success || !result.data?.shortUrl) {
      throw new Error('Invalid response from shortener service');
    }

    const shortUrl = result.data.shortUrl;
    logger.info('Token shortened successfully', { shortUrl, shortCode: result.data.shortCode });
    return shortUrl;
  } catch (error) {
    logger.error('Failed to shorten token with Ducat server', { error: error.message });
    throw error; // Re-throw to let caller handle fallback
  }
};
