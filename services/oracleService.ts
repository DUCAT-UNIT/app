/**
 * Oracle Service
 * Fetches price quotes from the Oracle API for vault operations
 */

import { OracleAPI, type PriceQuote } from '@ducat-unit/client-sdk';
import { API } from '../utils/constants';
import { logger } from '../utils/logger';

// Maximum age for oracle price quotes (5 minutes in seconds)
const MAX_QUOTE_AGE_SECONDS = 300;

/**
 * Fetches a price quote from the Oracle API
 * @param liquidationPrice - The liquidation threshold price
 * @returns Price quote with oracle signature
 */
export async function fetchPriceQuote(liquidationPrice: number): Promise<PriceQuote> {
  const thresholdPrice = Math.floor(liquidationPrice);
  // Ensure minimum threshold of 1
  const safeThreshold = thresholdPrice === 0 ? 1 : thresholdPrice;

  logger.debug(`[OracleService] Fetching price quote for threshold: ${safeThreshold}`);

  try {
    const quoteRes = await OracleAPI.quote.fetch_price_quote(
      API.QUOTE_SERVER,
      safeThreshold
    );

    if (!quoteRes.ok) {
      throw new Error(`Oracle API error: ${quoteRes.error}`);
    }

    const quote = quoteRes.data;

    // SECURITY: Validate oracle price is not stale
    // Stale prices can enable over-borrowing or manipulation of vault operations
    const nowSeconds = Math.floor(Date.now() / 1000);
    const quoteAge = nowSeconds - quote.latest_stamp;
    if (quote.latest_stamp > nowSeconds + 60) {
      throw new Error('Oracle price timestamp is in the future. Rejecting quote.');
    }
    if (quoteAge > MAX_QUOTE_AGE_SECONDS) {
      logger.error('[OracleService] Oracle price quote is stale', {
        quoteStamp: quote.latest_stamp,
        ageSeconds: quoteAge,
        maxAgeSeconds: MAX_QUOTE_AGE_SECONDS,
      });
      throw new Error(
        `Oracle price is stale (${Math.floor(quoteAge / 60)} minutes old). Please try again.`
      );
    }

    logger.debug('[OracleService] Price quote received:', { quote });
    return quote;
  } catch (error) {
    logger.error('[OracleService] Failed to fetch price quote:', { error });
    throw error instanceof Error ? error : new Error('Failed to fetch price quote from Oracle');
  }
}

/**
 * Fetches the current Bitcoin price from the Oracle API
 * @returns Current BTC price in USD
 */
export async function fetchCurrentPrice(): Promise<number> {
  try {
    const response = await fetch(`${API.PRICE_SERVER}/price`);
    if (!response.ok) {
      throw new Error(`Price API returned status ${response.status}`);
    }
    const data = await response.json();
    return data.price || data.curr_price;
  } catch (error) {
    logger.error('[OracleService] Failed to fetch current price:', { error });
    throw new Error('Failed to fetch current Bitcoin price');
  }
}
