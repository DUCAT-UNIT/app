/**
 * useBtcPriceHistory Hook
 * Fetches and caches BTC price history data from CoinGecko
 */

import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API, API_KEYS } from '../../../utils/constants';
import { logger } from '../../../utils/logger';
import type { BitcoinData, PriceTimeframe } from './types';
import { CACHE_KEY_PREFIX, CACHE_EXPIRY_MS } from './types';

interface UseBtcPriceHistoryResult {
  btcPrices: BitcoinData[] | null;
  loading: boolean;
}

/**
 * Hook to fetch BTC price history with caching
 */
export function useBtcPriceHistory(
  selectedTimeframe: PriceTimeframe,
  hasTransactions: boolean
): UseBtcPriceHistoryResult {
  const [btcPrices, setBtcPrices] = useState<BitcoinData[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch BTC price history
  useEffect(() => {
    if (!hasTransactions) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchPrices = async () => {
      const days = selectedTimeframe === '1D' ? 1 :
                   selectedTimeframe === '1W' ? 7 :
                   selectedTimeframe === '1M' ? 30 : 365;

      const cacheKey = `${CACHE_KEY_PREFIX}${selectedTimeframe}`;

      // Check cache
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached && !cancelled) {
          const { prices, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_EXPIRY_MS) {
            const bitcoinData: BitcoinData[] = prices.map((p: [number, number]) => ({
              timestamp: Math.floor(p[0] / 1000),
              price: String(p[1]),
            }));
            setBtcPrices(bitcoinData);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        logger.debug('Failed to read price cache', { error: err instanceof Error ? err.message : String(err) });
      }

      // Fetch from API
      try {
        const response = await fetch(
          `${API.COINGECKO}/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`,
          {
            headers: {
              'accept': 'application/json',
              'x-cg-demo-api-key': API_KEYS.COINGECKO
            }
          }
        );

        if (cancelled) return;

        if (response.ok) {
          const data = await response.json();
          if (data.prices?.length) {
            // Sample for performance
            const sampled = data.prices.length > 150
              ? data.prices.filter((_: [number, number], i: number) =>
                  i % Math.ceil(data.prices.length / 150) === 0)
              : data.prices;

            const bitcoinData: BitcoinData[] = sampled.map((p: [number, number]) => ({
              timestamp: Math.floor(p[0] / 1000),
              price: String(p[1]),
            }));

            setBtcPrices(bitcoinData);

            AsyncStorage.setItem(cacheKey, JSON.stringify({
              prices: sampled,
              timestamp: Date.now()
            })).catch((err) => logger.debug('Failed to cache prices', { error: err instanceof Error ? err.message : String(err) }));
          }
        }
      } catch (err) {
        logger.debug('Failed to fetch BTC prices', { error: err instanceof Error ? err.message : String(err) });
      }

      if (!cancelled) setLoading(false);
    };

    setLoading(true);
    fetchPrices();

    return () => { cancelled = true; };
  }, [selectedTimeframe, hasTransactions]);

  // Background preload other timeframes after initial load
  useEffect(() => {
    if (!hasTransactions || loading) return;

    const preloadTimeframes = async () => {
      const allTimeframes: PriceTimeframe[] = ['1W', '1M', '1Y'];
      const timeframesToPreload = allTimeframes.filter(tf => tf !== selectedTimeframe);

      for (const tf of timeframesToPreload) {
        const days = tf === '1W' ? 7 : tf === '1M' ? 30 : 365;
        const cacheKey = `${CACHE_KEY_PREFIX}${tf}`;

        // Check if already cached
        try {
          const cached = await AsyncStorage.getItem(cacheKey);
          if (cached) {
            const { timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_EXPIRY_MS) {
              continue; // Already cached and valid
            }
          }
        } catch (err) {
          logger.debug('Failed to read cache for preload', { timeframe: tf, error: err instanceof Error ? err.message : String(err) });
        }

        // Fetch and cache in background
        try {
          const response = await fetch(
            `${API.COINGECKO}/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`,
            {
              headers: {
                'accept': 'application/json',
                'x-cg-demo-api-key': API_KEYS.COINGECKO
              }
            }
          );

          if (response.ok) {
            const data = await response.json();
            if (data.prices?.length) {
              const sampled = data.prices.length > 150
                ? data.prices.filter((_: [number, number], i: number) =>
                    i % Math.ceil(data.prices.length / 150) === 0)
                : data.prices;

              await AsyncStorage.setItem(cacheKey, JSON.stringify({
                prices: sampled,
                timestamp: Date.now()
              }));
            }
          }
        } catch (err) {
          logger.debug('Failed to preload prices', { timeframe: tf, error: err instanceof Error ? err.message : String(err) });
        }

        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    };

    // Delay preloading to not interfere with initial render
    const timeoutId = setTimeout(preloadTimeframes, 2000);
    return () => clearTimeout(timeoutId);
  }, [hasTransactions, loading, selectedTimeframe]);

  return { btcPrices, loading };
}
