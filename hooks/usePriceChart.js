/**
 * usePriceChart Hook
 * Manages price chart data fetching, caching, and state
 * Extracted from AssetDetailScreen for better separation of concerns
 */

import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API, API_KEYS } from '../utils/constants';

const CACHE_KEY_PREFIX = 'btc_price_cache_';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes backoff after rate limit

// In-memory cache for instant access across navigations
const priceCache = {};

// Track last rate limit to prevent hammering the API
let lastRateLimitTime = 0;

// Sample data to reduce points to ~60
const sampleData = (data, targetPoints = 60) => {
  if (!data || data.length <= targetPoints) return data;

  const step = Math.floor(data.length / targetPoints);
  const sampled = [];

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
const calculatePriceDirection = (prices) => {
  const firstPrice = prices[0][1];
  const lastPrice = prices[prices.length - 1][1];
  const priceChange = lastPrice - firstPrice;
  const percentChange = ((priceChange / firstPrice) * 100);

  return {
    isPositive: priceChange >= 0,
    percentChange: percentChange.toFixed(2),
    dollarChange: Math.abs(priceChange).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  };
};

/**
 * Hook to manage BTC price chart data
 */
export function usePriceChart(assetType, selectedTimeframe) {
  // Initialize with cached data if available (synchronous)
  const initCacheKey = `${CACHE_KEY_PREFIX}${selectedTimeframe}`;
  const initCache = priceCache[initCacheKey];
  const hasValidCache = initCache && (Date.now() - initCache.timestamp < CACHE_EXPIRY_MS);

  const [priceData, setPriceData] = useState(hasValidCache ? initCache.prices : null);
  const [priceDirection, setPriceDirection] = useState(
    hasValidCache ? initCache.direction : { isPositive: true, percentChange: 0, dollarChange: 0 }
  );
  const [priceLoading, setPriceLoading] = useState(!hasValidCache && assetType === 'BTC');
  const [priceError, setPriceError] = useState(null);

  const fetchPriceData = useCallback(async () => {
    setPriceError(null);
    try {
      const days = selectedTimeframe === '1D' ? 1 :
                   selectedTimeframe === '1W' ? 7 :
                   selectedTimeframe === '1M' ? 30 : 365;

      const cacheKey = `${CACHE_KEY_PREFIX}${selectedTimeframe}`;

      // Check in-memory cache first (instant)
      if (priceCache[cacheKey]) {
        const { prices, timestamp, direction } = priceCache[cacheKey];
        const age = Date.now() - timestamp;

        if (age < CACHE_EXPIRY_MS) {
          setPriceData(prices);
          setPriceDirection(direction);
          setPriceLoading(false);
          return;
        }
      }

      // Check AsyncStorage cache (even if expired, use as fallback)
      let fallbackCache = null;
      try {
        const cachedData = await AsyncStorage.getItem(cacheKey);
        if (cachedData) {
          const { prices, timestamp } = JSON.parse(cachedData);
          const age = Date.now() - timestamp;

          if (age < CACHE_EXPIRY_MS) {
            const direction = calculatePriceDirection(prices);

            setPriceData(prices);
            setPriceDirection(direction);

            // Store in memory cache for next time
            priceCache[cacheKey] = { prices, timestamp, direction };

            setPriceLoading(false);
            return;
          }

          // Cache expired but keep as fallback if API fails
          fallbackCache = { prices, direction: calculatePriceDirection(prices) };
        }
      } catch (cacheError) {
        // Silently fail cache read
      }

      // Check if we're in rate limit backoff period
      const timeSinceRateLimit = Date.now() - lastRateLimitTime;
      if (lastRateLimitTime > 0 && timeSinceRateLimit < RATE_LIMIT_BACKOFF_MS) {
        // Use fallback cache if available, otherwise show error
        if (fallbackCache) {
          setPriceData(fallbackCache.prices);
          setPriceDirection(fallbackCache.direction);
          setPriceLoading(false);
          return;
        }
        const remainingMinutes = Math.ceil((RATE_LIMIT_BACKOFF_MS - timeSinceRateLimit) / 60000);
        throw new Error(`Rate limited. Please wait ${remainingMinutes} minute(s).`);
      }

      // Only show loading if we need to fetch from network
      setPriceLoading(true);

      // Fetch fresh data
      const response = await fetch(
        `${API.COINGECKO}/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`,
        {
          headers: {
            'accept': 'application/json',
            'x-cg-demo-api-key': API_KEYS.COINGECKO
          }
        }
      );

      if (response.status === 429) {
        lastRateLimitTime = Date.now();
        // Use fallback cache if available
        if (fallbackCache) {
          setPriceData(fallbackCache.prices);
          setPriceDirection(fallbackCache.direction);
          setPriceLoading(false);
          return;
        }
        throw new Error('Rate limit reached. Using cached data.');
      }

      if (!response.ok) {
        // Use fallback cache if available
        if (fallbackCache) {
          setPriceData(fallbackCache.prices);
          setPriceDirection(fallbackCache.direction);
          setPriceLoading(false);
          return;
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.prices && data.prices.length > 0) {
        // Sample data to ~60 points
        const sampledPrices = sampleData(data.prices, 60);

        // Calculate price direction (using original data endpoints)
        const direction = calculatePriceDirection(data.prices);

        setPriceData(sampledPrices);
        setPriceDirection(direction);

        const timestamp = Date.now();

        // Store in memory cache immediately
        priceCache[cacheKey] = { prices: sampledPrices, timestamp, direction };

        // Cache to AsyncStorage (async, non-blocking)
        AsyncStorage.setItem(
          cacheKey,
          JSON.stringify({
            prices: sampledPrices,
            timestamp
          })
        ).catch(() => {
          // Silently fail cache write
        });
      } else {
        throw new Error('Invalid data format from API');
      }
    } catch (error) {
      setPriceError(error.message || 'Failed to load price data');
      setPriceData(null);
    } finally {
      setPriceLoading(false);
    }
  }, [selectedTimeframe]);

  // Fetch price data from CoinGecko - only when timeframe changes or if no cache
  useEffect(() => {
    if (assetType === 'BTC') {
      const cacheKey = `${CACHE_KEY_PREFIX}${selectedTimeframe}`;
      const cached = priceCache[cacheKey];
      const isCacheValid = cached && (Date.now() - cached.timestamp < CACHE_EXPIRY_MS);

      // Only fetch if no in-memory cache or cache is stale
      if (!isCacheValid) {
        fetchPriceData();
      } else {
        // Update state with cached data (only runs when timeframe changes)
        setPriceData(cached.prices);
        setPriceDirection(cached.direction);
        setPriceLoading(false);
      }
    } else {
      setPriceLoading(false);
    }
  }, [assetType, selectedTimeframe, fetchPriceData]);

  return {
    priceData,
    priceDirection,
    priceLoading,
    priceError,
    setPriceError
  };
}
