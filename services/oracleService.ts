/**
 * Oracle Service
 * Fetches price quotes from the Oracle API for vault operations
 */

import { OracleAPI, type PriceQuote } from '@ducat-unit/client-sdk';
import { API } from '../utils/constants';
import { logger } from '../utils/logger';

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

    logger.debug('[OracleService] Price quote received:', { quote: quoteRes.data });
    return quoteRes.data;
  } catch (error) {
    logger.error('[OracleService] Failed to fetch price quote:', { error });
    throw new Error('Failed to fetch price quote from Oracle');
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
