/**
 * Oracle Service
 * Fetches price quotes from the Oracle API for vault operations
 */

import type { PriceQuote } from '@ducat-unit/client-sdk';
import { API } from '../utils/constants';
import { logger } from '../utils/logger';
import { getJSON } from '../utils/apiClient';
import { getJsonWithNativeTimeout } from '../utils/nativeHttp';

// Maximum age for oracle price quotes (5 minutes in seconds)
export const MAX_QUOTE_AGE_SECONDS = 300;

interface FetchPriceQuoteOptions {
  timeout?: number;
  dedupe?: boolean;
  cache?: boolean;
  transport?: 'fetch' | 'xhr';
}

function isTemporaryOracleQuoteGap(error: Error): boolean {
  return /price point not found|invalid quote|HTTP 400/i.test(error.message);
}

/**
 * Fetches a price quote from the Oracle API
 * @param liquidationPrice - The liquidation threshold price
 * @returns Price quote with oracle signature
 */
export async function fetchPriceQuote(
  liquidationPrice: number,
  options: FetchPriceQuoteOptions = {}
): Promise<PriceQuote> {
  const thresholdPrice = Math.floor(liquidationPrice);
  // Ensure minimum threshold of 1
  const safeThreshold = thresholdPrice === 0 ? 1 : thresholdPrice;
  const useDedupe = options.dedupe !== false;
  const useCache = options.cache !== false;
  const quoteKey = `oracle-price-quote-${safeThreshold}`;

  logger.debug(`[OracleService] Fetching price quote for threshold: ${safeThreshold}`);

  try {
    const query = new URLSearchParams({ th: String(safeThreshold) });
    const url = `${API.QUOTE_SERVER}/api/quote?${query.toString()}`;
    const quote =
      options.transport === 'xhr'
        ? await getJsonWithNativeTimeout<PriceQuote>(url, {
            timeout: options.timeout ?? 8000,
            headers: { Accept: 'application/json' },
          })
        : await getJSON<PriceQuote>(url, {
            timeout: options.timeout ?? 8000,
            retryOptions: { maxRetries: 1 },
            dedupeKey: useDedupe ? quoteKey : undefined,
            cacheKey: useCache ? quoteKey : undefined,
            cacheTtlMs: MAX_QUOTE_AGE_SECONDS * 1000,
            circuitKey: 'oracle-price-quote',
          });

    if (typeof quote.latest_stamp !== 'number') {
      throw new Error('Oracle price quote is missing timestamp');
    }

    // SECURITY: Validate oracle price is not stale
    // Stale prices can enable over-borrowing or manipulation of vault operations
    const nowSeconds = Math.floor(Date.now() / 1000);
    const quoteAge = nowSeconds - quote.latest_stamp;
    if (quote.latest_stamp > nowSeconds + 10) {
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
    if (error instanceof Error) {
      if (error.name === 'AbortError' || /abort/i.test(error.message)) {
        throw new Error('Timed out fetching oracle price quote. Please try again.');
      }
      if (isTemporaryOracleQuoteGap(error)) {
        throw new Error(
          'Oracle price quote is temporarily unavailable. Please try again in a minute.'
        );
      }
      throw error;
    }
    throw new Error('Failed to fetch price quote from Oracle');
  }
}

/**
 * Fetches the current Bitcoin price from the Oracle API
 * @returns Current BTC price in USD
 */
export async function fetchCurrentPrice(): Promise<number> {
  try {
    const data = await getJSON<{ price?: number; curr_price?: number }>(
      `${API.PRICE_SERVER}/api/price/latest`,
      {
        timeout: 8000,
        retryOptions: { maxRetries: 1 },
        dedupeKey: 'oracle-current-btc-price',
        cacheKey: 'oracle-current-btc-price',
        cacheTtlMs: 30_000,
        staleOnError: true,
        circuitKey: 'oracle-current-btc-price',
      }
    );
    const price = data.price || data.curr_price;
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > 10_000_000) {
      throw new Error(`Invalid oracle price: ${price}`);
    }
    return price;
  } catch (error) {
    logger.error('[OracleService] Failed to fetch current price:', { error });
    throw new Error('Failed to fetch current Bitcoin price');
  }
}
