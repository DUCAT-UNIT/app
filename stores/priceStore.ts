/**
 * Price Store (Zustand)
 * Manages BTC price data and fetching
 *
 * MIGRATION: Replaces PriceContext
 * Benefits: No provider needed, auto-refresh built-in, selective re-renders
 */

import { create } from 'zustand';
import { fetchBtcPrice as fetchBtcPriceService } from '../services/balanceService';
import { logger } from '../utils/logger';

interface PriceState {
  btcPrice: number | null;
  loadingBtcPrice: boolean;
  lastFetchTime: number | null;
}

interface PriceActions {
  fetchBtcPrice: () => Promise<void>;
  startAutoRefresh: () => () => void;
}

type PriceStore = PriceState & PriceActions;

// Store the interval ID outside the store to prevent it from being serialized
let refreshInterval: NodeJS.Timeout | null = null;

export const usePriceStore = create<PriceStore>((set, get) => ({
  // State
  btcPrice: null,
  loadingBtcPrice: false,
  lastFetchTime: null,

  // Actions
  fetchBtcPrice: async () => {
    // Prevent concurrent fetches
    if (get().loadingBtcPrice) return;

    try {
      set({ loadingBtcPrice: true });
      const price = await fetchBtcPriceService();
      set({
        btcPrice: price,
        lastFetchTime: Date.now(),
      });
    } catch (error) {
      logger.debug('Failed to fetch BTC price', { error: error instanceof Error ? error.message : String(error) });
      set({ btcPrice: null });
    } finally {
      set({ loadingBtcPrice: false });
    }
  },

  // Start auto-refresh every 60 seconds, returns cleanup function
  startAutoRefresh: () => {
    // Clear any existing interval
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }

    // Fetch immediately
    get().fetchBtcPrice();

    // Then refresh every 60 seconds
    refreshInterval = setInterval(() => {
      get().fetchBtcPrice();
    }, 60000);

    // Return cleanup function
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    };
  },
}));

/**
 * Selector hooks for granular subscriptions
 */
export const useBtcPrice = () => usePriceStore((state) => state.btcPrice);
export const useLoadingBtcPrice = () => usePriceStore((state) => state.loadingBtcPrice);

/**
 * Reset store to initial state (useful for testing)
 */
export const resetPriceStore = () => {
  // Clear any existing interval
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }

  usePriceStore.setState({
    btcPrice: null,
    loadingBtcPrice: false,
    lastFetchTime: null,
  });
};

/**
 * usePrice - Backwards-compatible hook that returns price state and actions
 */
export const usePrice = () => {
  const store = usePriceStore();
  return {
    btcPrice: store.btcPrice,
    loadingBtcPrice: store.loadingBtcPrice,
    fetchBtcPrice: store.fetchBtcPrice,
  };
};
