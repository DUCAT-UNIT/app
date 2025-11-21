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
export const shortenUrl = async (longUrl, slashtag = null) => {
  try {
    // Check if API key is configured
    if (!REBRANDLY_API_KEY) {
      logger.warn('Rebrandly API key not configured, using full URL');
      return longUrl;
    }

    // Check if URL is too long for Rebrandly (max 2048 characters)
    if (longUrl.length > 2048) {
      logger.warn('URL too long for Rebrandly, using full URL', { urlLength: longUrl.length });
      return longUrl;
    }

    logger.info('Shortening URL with Rebrandly', { urlLength: longUrl.length, slashtag });

    // Prepare request body
    const requestBody = {
      destination: longUrl,
    };

    // Add custom slashtag if provided (makes URL human-readable)
    if (slashtag) {
      requestBody.slashtag = slashtag;
    }

    // Add custom domain if configured
    if (REBRANDLY_CUSTOM_DOMAIN) {
      requestBody.domain = { fullName: REBRANDLY_CUSTOM_DOMAIN };
      logger.info('Using custom domain', { domain: REBRANDLY_CUSTOM_DOMAIN });
    }

    // Add title for link management
    requestBody.title = slashtag || 'Spectre Token';

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
 * Shorten a URL and attach token data to the link
 * @param {string} destinationUrl - The destination URL
 * @param {string} slashtag - Human-readable slashtag
 * @param {string} token - Cashu token to store in link notes
 * @returns {Promise<string>} The shortened URL
 */
export const shortenUrlWithToken = async (destinationUrl, slashtag, token) => {
  try {
    // Check if API key is configured
    if (!REBRANDLY_API_KEY) {
      logger.warn('Rebrandly API key not configured');
      // Fallback: encode token in URL-safe base64
      const urlSafeToken = btoa(token).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      return `${destinationUrl}?t=${urlSafeToken}`;
    }

    logger.info('Creating short URL with token metadata', { slashtag });

    // Generate a unique ID for this token
    const tokenId = Math.random().toString(36).substring(2, 15);

    // Prepare request body
    const requestBody = {
      destination: `${destinationUrl}?id=${tokenId}`, // Include ID in destination
      title: slashtag || 'Spectre Token',
    };

    // Store the token in tags (split into chunks of 50 chars max per tag)
    if (token) {
      const chunkSize = 50;
      const tokenChunks = [`id:${tokenId}`]; // First tag is the ID marker
      for (let i = 0; i < token.length; i += chunkSize) {
        tokenChunks.push(token.substring(i, i + chunkSize));
      }
      requestBody.tags = tokenChunks;
      logger.info('Storing token in tags', { tokenId, chunks: tokenChunks.length - 1 });
    }

    // Add slashtag
    if (slashtag) {
      requestBody.slashtag = slashtag;
    }

    // Add custom domain
    if (REBRANDLY_CUSTOM_DOMAIN) {
      requestBody.domain = { fullName: REBRANDLY_CUSTOM_DOMAIN };
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

    logger.info('Short URL created with token metadata', { shortUrl, tokenId });
    return `https://${shortUrl}`;
  } catch (error) {
    logger.error('Failed to create short URL with token', { error: error.message });
    // Fallback: encode token in URL-safe base64
    const urlSafeToken = btoa(token).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return `${destinationUrl}?t=${urlSafeToken}`;
  }
};

/**
 * Fetch token from Rebrandly using token ID
 * @param {string} tokenId - The unique token ID
 * @returns {Promise<string|null>} The Cashu token or null if not found
 */
export const fetchTokenFromRebrandly = async (tokenId) => {
  try {
    if (!REBRANDLY_API_KEY) {
      logger.warn('Rebrandly API key not configured, cannot fetch token');
      return null;
    }

    logger.info('Fetching token from Rebrandly', { tokenId });

    // Search for links with this token ID in tags
    // We need to use the /links endpoint with filtering
    const searchUrl = `${REBRANDLY_API_ENDPOINT}?orderBy=createdAt&orderDir=desc&limit=100`;

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'apikey': REBRANDLY_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Rebrandly API error: ${response.status}`);
    }

    const links = await response.json();

    // Find the link with our token ID in tags
    const targetLink = links.find(link =>
      link.tags && link.tags.includes(`id:${tokenId}`)
    );

    if (!targetLink) {
      logger.warn('Token not found in Rebrandly', { tokenId });
      return null;
    }

    // Reconstruct token from tags (skip the first tag which is the ID marker)
    const tokenTags = targetLink.tags.filter(tag => !tag.startsWith('id:'));
    const token = tokenTags.join('');

    logger.info('Token fetched successfully from Rebrandly', { tokenId, tokenLength: token.length });
    return token;
  } catch (error) {
    logger.error('Failed to fetch token from Rebrandly', { error: error.message, tokenId });
    return null;
  }
};

/**
 * Create a short URL for a Spectre deeplink
 * @param {string} deeplinkUrl - The full deeplink URL with base64 token (IGNORED - we use destination + tags instead)
 * @param {string} address - Recipient address (for slashtag)
 * @param {number} amount - Amount in UNIT (for slashtag)
 * @param {string} token - The full Cashu token to store in link tags
 * @returns {Promise<string>} The shortened URL
 */
export const createSpectreShortUrl = async (deeplinkUrl, address, amount, token) => {
  // Create human-readable slashtag: amount-to-address-entropy
  // Truncate address to last 8 chars for brevity
  const addressSuffix = address.slice(-8);

  // Generate 6-character random entropy (alphanumeric)
  const entropy = Math.random().toString(36).substring(2, 8);

  // Format amount for URL: replace decimal point with 'p' (e.g., 0.07 -> 0p07, 100 -> 100)
  // Rebrandly only allows: a-z A-Z 0-9 -_/
  const amountFormatted = amount.toString().replace('.', 'p');

  const slashtag = `${amountFormatted}-to-${addressSuffix}-${entropy}`;

  // Use a minimal destination URL - the link ID will be used to fetch the token
  const minimalDestination = 'https://ducatprotocol.com/unit';

  return shortenUrlWithToken(minimalDestination, slashtag, token);
};
