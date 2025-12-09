/**
 * usePriceChart Hook
 * Manages price chart data fetching, caching, and state
 * Extracted from AssetDetailScreen for better separation of concerns
 */

import { useState, useEffect, Dispatch, SetStateAction } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API, API_KEYS } from '../utils/constants';
import { formatFiat } from '../utils/formatters';

const CACHE_KEY_PREFIX = 'btc_price_cache_';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes backoff after rate limit

type Timeframe = '1D' | '1W' | '1M' | '1Y';
type PricePoint = [number, number]; // [timestamp, price]

interface PriceDirection {
  isPositive: boolean;
  percentChange: string;
  dollarChange: string;
}

interface CacheEntry {
  prices: PricePoint[];
  timestamp: number;
  direction: PriceDirection;
}

interface UsePriceChartReturn {
  priceData: PricePoint[] | null;
  priceDirection: PriceDirection;
  priceLoading: boolean;
  priceError: string | null;
  setPriceError: Dispatch<SetStateAction<string | null>>;
}

// In-memory cache for instant access across navigations
const priceCache: Record<string, CacheEntry> = {};

// Track last rate limit to prevent hammering the API
let lastRateLimitTime = 0;

// Reset function for testing
export const _resetPriceCache = (): void => {
  Object.keys(priceCache).forEach(key => delete priceCache[key]);
  lastRateLimitTime = 0;
};

// Sample data to reduce points to ~60
const sampleData = (data: PricePoint[] | null, targetPoints = 60): PricePoint[] | null => {
  if (!data || data.length <= targetPoints) return data;

  const step = Math.floor(data.length / targetPoints);
  const sampled: PricePoint[] = [];

  for (let i = 0; i < data.length; i += step) {
    sampled.push(data[i]);
  }

  // Always include the last point
  if (sampled[sampled.length - 1] !== data[data.length - 1]) {
    sampled.push(data[data.length - 1]);
  }

  return sampled;
};

/**
 * Calculate price direction and change
 */
const calculatePriceDirection = (prices: PricePoint[]): PriceDirection => {
  const firstPrice = prices[0][1];
  const lastPrice = prices[prices.length - 1][1];
  const priceChange = lastPrice - firstPrice;
  const percentChange = ((priceChange / firstPrice) * 100);

  return {
    isPositive: priceChange >= 0,
    percentChange: percentChange.toFixed(2),
    dollarChange: formatFiat(Math.abs(priceChange))
  };
};

/**
 * Hook to manage BTC price chart data
 */
export function usePriceChart(assetType: string, selectedTimeframe: Timeframe): UsePriceChartReturn {
  const [priceData, setPriceData] = useState<PricePoint[] | null>(null);
  const [priceDirection, setPriceDirection] = useState<PriceDirection>(
    { isPositive: true, percentChange: '0', dollarChange: '0' }
  );
  const [priceLoading, setPriceLoading] = useState(assetType === 'BTC');
  const [priceError, setPriceError] = useState<string | null>(null);

  // Fetch data when timeframe changes
  useEffect(() => {
    if (assetType !== 'BTC') {
      setPriceLoading(false);
      return;
    }

    let cancelled = false;

    const fetchPriceData = async () => {
      const days = selectedTimeframe === '1D' ? 1 :
                   selectedTimeframe === '1W' ? 7 :
                   selectedTimeframe === '1M' ? 30 : 365;

      const cacheKey = `${CACHE_KEY_PREFIX}${selectedTimeframe}`;
      let hasShownCache = false;

      // STEP 1: Always check and show cache first (instant UX)
      // Check in-memory cache first
      if (priceCache[cacheKey]) {
        const { prices, direction, timestamp } = priceCache[cacheKey];
        if (!cancelled) {
          setPriceData(prices);
          setPriceDirection(direction);
          setPriceLoading(false);
          setPriceError(null);
        }
        hasShownCache = true;

        // If cache is fresh, we're done - no need to fetch
        const age = Date.now() - timestamp;
        if (age < CACHE_EXPIRY_MS) {
          return;
        }
      }

      // If no in-memory cache, check AsyncStorage
      if (!hasShownCache) {
        try {
          const cachedData = await AsyncStorage.getItem(cacheKey);
          if (cachedData && !cancelled) {
            const { prices, timestamp } = JSON.parse(cachedData);
            const direction = calculatePriceDirection(prices);

            setPriceData(prices);
            setPriceDirection(direction);
            setPriceLoading(false);
            setPriceError(null);
            hasShownCache = true;

            // Store in memory cache
            priceCache[cacheKey] = { prices, timestamp: timestamp || Date.now(), direction };

            // If cache is fresh, we're done
            const age = Date.now() - (timestamp || 0);
            if (age < CACHE_EXPIRY_MS) {
              return;
            }
          }
        } catch (cacheError) {
          // Silently fail cache read
        }
      }

      // STEP 2: Check if we should fetch fresh data
      // Skip fetch if in rate limit backoff period
      const timeSinceRateLimit = Date.now() - lastRateLimitTime;
      if (lastRateLimitTime > 0 && timeSinceRateLimit < RATE_LIMIT_BACKOFF_MS) {
        if (!cancelled) setPriceError(null);
        return;
      }

      // STEP 3: Fetch fresh data in background (don't show loading if we have cache)
      if (!hasShownCache && !cancelled) {
        setPriceLoading(true);
      }

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

        if (response.status === 429) {
          lastRateLimitTime = Date.now();
          setPriceError(null);
          setPriceLoading(false);
          return;
        }

        if (!response.ok) {
          setPriceError(null);
          setPriceLoading(false);
          return;
        }

        const data = await response.json();

        if (cancelled) return;

        if (data.prices && data.prices.length > 0) {
          // Sample data to ~60 points
          const sampledPrices = sampleData(data.prices, 60);

          // Calculate price direction (using original data endpoints)
          const direction = calculatePriceDirection(data.prices);

          setPriceData(sampledPrices);
          setPriceDirection(direction);

          const timestamp = Date.now();

          // Store in memory cache immediately (only if we have valid data)
          if (sampledPrices) {
            priceCache[cacheKey] = { prices: sampledPrices, timestamp, direction };
          }

          // Cache to AsyncStorage (async, non-blocking)
          // Cache write failures are non-critical - app works without cache
          AsyncStorage.setItem(
            cacheKey,
            JSON.stringify({
              prices: sampledPrices,
              timestamp
            })
          ).catch(() => {
            // Cache write failures are expected in some scenarios (e.g., storage full)
            // and don't affect app functionality - data will be fetched fresh next time
          });
        } else {
          setPriceError(null);
        }
      } catch (error: unknown) {
        if (cancelled) return;
        // Only show error if we don't have any cached data for this timeframe
        if (!priceCache[cacheKey]) {
          setPriceError((error instanceof Error ? error.message : String(error)) || 'Failed to load price data');
        }
      } finally {
        if (!cancelled) {
          setPriceLoading(false);
        }
      }
    };

    fetchPriceData();

    return () => {
      cancelled = true;
    };
  }, [assetType, selectedTimeframe]);

  return {
    priceData,
    priceDirection,
    priceLoading,
    priceError,
    setPriceError
  };
}
