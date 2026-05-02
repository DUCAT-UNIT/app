/**
 * URL Shortener Service
 * Creates short URLs for Cashu tokens using Ducat server
 */

import { logger } from '../utils/logger';
import { postJSON } from '../utils/apiClient';

interface ShortenerResponse {
  success: boolean;
  data?: {
    shortUrl: string;
    shortCode: string;
  };
}

/**
 * Shorten Cashu token using custom short.ducatprotocol.com server
 * @param cashuToken - The Cashu token to shorten
 * @returns The shortened URL
 */
export const shortenCashuToken = async (cashuToken: string): Promise<string> => {
  try {
    logger.info('Shortening Cashu token with Ducat server', { tokenLength: cashuToken.length });

    const result = await postJSON<ShortenerResponse>(
      'https://short.ducatprotocol.com/api/shorten',
      { cashuToken },
      {
        timeout: 10000,
        retryOptions: { maxRetries: 1 },
        circuitKey: 'ducat-shortener',
      },
    );

    if (!result.success || !result.data?.shortUrl) {
      throw new Error('Invalid response from shortener service');
    }

    const shortUrl = result.data.shortUrl;

    // Validate the returned URL is from the expected domain
    try {
      const parsed = new URL(shortUrl);
      if (!parsed.hostname.endsWith('.ducatprotocol.com')) {
        throw new Error(`Unexpected shortener domain: ${parsed.hostname}`);
      }
    } catch (urlError) {
      if (urlError instanceof Error && urlError.message.startsWith('Unexpected')) throw urlError;
      throw new Error('Shortener returned invalid URL');
    }

    logger.info('Token shortened successfully', {
      shortUrlLength: shortUrl.length,
      shortCode: result.data.shortCode,
    });
    return shortUrl;
  } catch (error: unknown) {
    logger.error('Failed to shorten token with Ducat server', { error: (error as Error).message });
    throw error; // Re-throw to let caller handle fallback
  }
};
