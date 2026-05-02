/**
 * Price Store (Zustand)
 * Manages BTC and ETH price data and fetching
 *
 * MIGRATION: Replaces PriceContext
 * Benefits: No provider needed, auto-refresh built-in, selective re-renders
 */

import { create } from 'zustand';
import { AppState, AppStateStatus } from 'react-native';
import {
  fetchBtcPrice as fetchBtcPriceService,
  fetchEthPrice as fetchEthPriceService,
} from '../services/balanceService';
import { logger } from '../utils/logger';

interface PriceState {
  btcPrice: number | null;
  ethPrice: number | null;
  loadingBtcPrice: boolean;
  loadingEthPrice: boolean;
  lastFetchTime: number | null;
}

interface PriceActions {
  fetchBtcPrice: () => Promise<void>;
  fetchEthPrice: () => Promise<void>;
  setFallbackBtcPrice: (price: number) => void;
  startAutoRefresh: () => () => void;
}

type PriceStore = PriceState & PriceActions;

// Store the interval ID outside the store to prevent it from being serialized
let refreshInterval: NodeJS.Timeout | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let currentAppState: AppStateStatus = AppState.currentState;

const isValidUsdPrice = (price: unknown): price is number => (
  typeof price === 'number'
  && Number.isFinite(price)
  && price > 0
  && price < 10_000_000
);

export const usePriceStore = create<PriceStore>((set, get) => ({
  // State
  btcPrice: null,
  ethPrice: null,
  loadingBtcPrice: false,
  loadingEthPrice: false,
  lastFetchTime: null,

  // Actions
  fetchBtcPrice: async () => {
    // Prevent concurrent fetches
    if (get().loadingBtcPrice) return;

    try {
      set({ loadingBtcPrice: true });
      const price = await fetchBtcPriceService();
      if (isValidUsdPrice(price)) {
        set({
          btcPrice: price,
          lastFetchTime: Date.now(),
        });
      }
    } catch (error) {
      logger.debug('Failed to fetch BTC price', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      set({ loadingBtcPrice: false });
    };
  },

  fetchEthPrice: async () => {
    if (get().loadingEthPrice) return;

    try {
      set({ loadingEthPrice: true });
      const price = await fetchEthPriceService();
      if (isValidUsdPrice(price)) {
        set({
          ethPrice: price,
          lastFetchTime: Date.now(),
        });
      }
    } catch (error) {
      logger.debug('Failed to fetch ETH price', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      set({ loadingEthPrice: false });
    }
  },

  setFallbackBtcPrice: (price: number) => {
    if (!isValidUsdPrice(price) || get().btcPrice !== null) {
      return;
    }

    set({
      btcPrice: price,
      lastFetchTime: Date.now(),
    });
  },

  // Start auto-refresh every 60 seconds, returns cleanup function
  startAutoRefresh: () => {
    // Clear any existing interval
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    if (appStateSubscription) {
      appStateSubscription.remove();
      appStateSubscription = null;
    }

    const startRefreshLoop = () => {
      if (refreshInterval || currentAppState !== 'active') {
        return;
      }

      get().fetchBtcPrice();
      get().fetchEthPrice();
      refreshInterval = setInterval(() => {
        if (currentAppState === 'active') {
          get().fetchBtcPrice();
          get().fetchEthPrice();
        }
      }, 60000);
      refreshInterval.unref?.();
    };

    const stopRefreshLoop = () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    }

    startRefreshLoop();

    appStateSubscription = AppState.addEventListener('change', (nextState) => {
      const wasInactive = currentAppState !== 'active';
      currentAppState = nextState;

      if (nextState === 'active') {
        stopRefreshLoop();
        startRefreshLoop();

        if (wasInactive) {
          get().fetchBtcPrice();
          get().fetchEthPrice();
        }
        return;
      }

      stopRefreshLoop();
    });

    // Return cleanup function
    return () => {
      stopRefreshLoop();
      if (appStateSubscription) {
        appStateSubscription.remove();
        appStateSubscription = null;
      }
    };
  },
}));

/**
 * Reset store to initial state (useful for testing)
 */
export const resetPriceStore = () => {
  // Clear any existing interval
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  currentAppState = AppState.currentState;

  usePriceStore.setState({
    btcPrice: null,
    ethPrice: null,
    loadingBtcPrice: false,
    loadingEthPrice: false,
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
    ethPrice: store.ethPrice,
    loadingBtcPrice: store.loadingBtcPrice,
    loadingEthPrice: store.loadingEthPrice,
    fetchBtcPrice: store.fetchBtcPrice,
    fetchEthPrice: store.fetchEthPrice,
  };
};
