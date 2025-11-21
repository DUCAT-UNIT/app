/**
 * URL Shortener Service using Rebrandly
 * Creates short URLs for Spectre deeplinks
 */

import { logger } from '../utils/logger';

// Rebrandly API configuration
const REBRANDLY_API_KEY = process.env.EXPO_PUBLIC_REBRANDLY_API_KEY || '';
const REBRANDLY_CUSTOM_DOMAIN = process.env.EXPO_PUBLIC_REBRANDLY_DOMAIN || ''; // e.g., 'ducat.link'
const REBRANDLY_API_ENDPOINT = 'https://api.rebrandly.com/v1/links';

/**
 * Shorten a URL using Rebrandly
 * @param {string} longUrl - The full URL to shorten
 * @returns {Promise<string>} The shortened URL
 */
export const shortenUrl = async (longUrl) => {
  try {
    // Check if API key is configured
    if (!REBRANDLY_API_KEY) {
      logger.warn('Rebrandly API key not configured, using full URL');
      return longUrl;
    }

    logger.info('Shortening URL with Rebrandly', { urlLength: longUrl.length });

    // Prepare request body
    const requestBody = {
      destination: longUrl,
    };

    // Add custom domain if configured
    if (REBRANDLY_CUSTOM_DOMAIN) {
      requestBody.domain = { fullName: REBRANDLY_CUSTOM_DOMAIN };
      logger.info('Using custom domain', { domain: REBRANDLY_CUSTOM_DOMAIN });
    }

    const response = await fetch(REBRANDLY_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': REBRANDLY_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Rebrandly API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const shortUrl = data.shortUrl;

    logger.info('URL shortened successfully', { shortUrl });
    return `https://${shortUrl}`;
  } catch (error) {
    logger.error('Failed to shorten URL', { error: error.message });
    // Fallback to original URL if shortening fails
    logger.warn('Falling back to original URL');
    return longUrl;
  }
};

/**
 * Create a short URL for a Spectre deeplink
 * @param {string} deeplinkUrl - The full deeplink URL with base64 token
 * @returns {Promise<string>} The shortened URL
 */
export const createSpectreShortUrl = async (deeplinkUrl) => {
  return shortenUrl(deeplinkUrl);
};
