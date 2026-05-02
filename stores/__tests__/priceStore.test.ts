/**
 * Tests for priceStore
 * Consolidated to test meaningful behavior - fetching, auto-refresh, concurrency
 */

import { act } from '@testing-library/react-native';
import { usePriceStore, resetPriceStore } from '../priceStore';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockFetchBtcPrice = jest.fn();
const mockFetchEthPrice = jest.fn();
jest.mock('../../services/balanceService', () => ({
  fetchBtcPrice: () => mockFetchBtcPrice(),
  fetchEthPrice: () => mockFetchEthPrice(),
}));

describe('priceStore', () => {
  beforeEach(() => {
    resetPriceStore();
    jest.useFakeTimers();
    mockFetchBtcPrice.mockReset();
    mockFetchEthPrice.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should have correct initial state', () => {
    const state = usePriceStore.getState();
      expect(state).toMatchObject({
        btcPrice: null,
        ethPrice: null,
        loadingBtcPrice: false,
        loadingEthPrice: false,
        lastFetchTime: null,
      });
  });

  describe('fetchEthPrice', () => {
    it('should fetch and update ethPrice on success', async () => {
      mockFetchEthPrice.mockResolvedValueOnce(3200);
      const { fetchEthPrice } = usePriceStore.getState();

      await act(async () => { await fetchEthPrice(); });

      const state = usePriceStore.getState();
      expect(state.ethPrice).toBe(3200);
      expect(state.loadingEthPrice).toBe(false);
      expect(state.lastFetchTime).not.toBeNull();
    });

    it('should preserve the last valid ethPrice when a later fetch fails', async () => {
      mockFetchEthPrice
        .mockResolvedValueOnce(3200)
        .mockRejectedValueOnce(new Error('Network error'));
      const { fetchEthPrice } = usePriceStore.getState();

      await act(async () => { await fetchEthPrice(); });
      await act(async () => { await fetchEthPrice(); });

      expect(usePriceStore.getState().ethPrice).toBe(3200);
      expect(usePriceStore.getState().loadingEthPrice).toBe(false);
    });

    it('should ignore invalid ETH price responses without clearing a valid price', async () => {
      mockFetchEthPrice
        .mockResolvedValueOnce(3200)
        .mockResolvedValueOnce(null);
      const { fetchEthPrice } = usePriceStore.getState();

      await act(async () => { await fetchEthPrice(); });
      await act(async () => { await fetchEthPrice(); });

      expect(usePriceStore.getState().ethPrice).toBe(3200);
    });

    it('should prevent concurrent ETH price fetches', async () => {
      let resolveFirst: (value: number) => void;
      mockFetchEthPrice.mockReturnValueOnce(new Promise<number>((resolve) => {
        resolveFirst = resolve;
      }));

      const { fetchEthPrice } = usePriceStore.getState();
      let firstFetchPromise: Promise<void>;

      act(() => { firstFetchPromise = fetchEthPrice(); });
      await act(async () => { await fetchEthPrice(); });

      expect(mockFetchEthPrice).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveFirst!(3200);
        await firstFetchPromise;
      });
    });
  });

  describe('fetchBtcPrice', () => {
    it('should fetch and update btcPrice on success', async () => {
      mockFetchBtcPrice.mockResolvedValueOnce(50000);
      const { fetchBtcPrice } = usePriceStore.getState();

      await act(async () => { await fetchBtcPrice(); });

      const state = usePriceStore.getState();
      expect(state.btcPrice).toBe(50000);
      expect(state.loadingBtcPrice).toBe(false);
      expect(state.lastFetchTime).not.toBeNull();
    });

    it('should keep btcPrice null on initial fetch error', async () => {
      mockFetchBtcPrice.mockRejectedValueOnce(new Error('Network error'));
      const { fetchBtcPrice } = usePriceStore.getState();

      await act(async () => { await fetchBtcPrice(); });

      expect(usePriceStore.getState().btcPrice).toBeNull();
      expect(usePriceStore.getState().loadingBtcPrice).toBe(false);
    });

    it('should preserve the last valid btcPrice when a later fetch fails', async () => {
      mockFetchBtcPrice
        .mockResolvedValueOnce(50000)
        .mockRejectedValueOnce(new Error('Network error'));
      const { fetchBtcPrice } = usePriceStore.getState();

      await act(async () => { await fetchBtcPrice(); });
      await act(async () => { await fetchBtcPrice(); });

      expect(usePriceStore.getState().btcPrice).toBe(50000);
      expect(usePriceStore.getState().loadingBtcPrice).toBe(false);
    });

    it('should ignore invalid price responses without clearing a valid price', async () => {
      mockFetchBtcPrice
        .mockResolvedValueOnce(50000)
        .mockResolvedValueOnce(null);
      const { fetchBtcPrice } = usePriceStore.getState();

      await act(async () => { await fetchBtcPrice(); });
      await act(async () => { await fetchBtcPrice(); });

      expect(usePriceStore.getState().btcPrice).toBe(50000);
    });

    it('should set loadingBtcPrice during fetch', async () => {
      let resolvePromise: (value: number) => void;
      mockFetchBtcPrice.mockReturnValueOnce(new Promise<number>((resolve) => {
        resolvePromise = resolve;
      }));

      const { fetchBtcPrice } = usePriceStore.getState();
      let fetchPromise: Promise<void>;

      act(() => { fetchPromise = fetchBtcPrice(); });
      expect(usePriceStore.getState().loadingBtcPrice).toBe(true);

      await act(async () => {
        resolvePromise!(50000);
        await fetchPromise;
      });
      expect(usePriceStore.getState().loadingBtcPrice).toBe(false);
    });

    it('should prevent concurrent fetches', async () => {
      let resolveFirst: (value: number) => void;
      mockFetchBtcPrice.mockReturnValueOnce(new Promise<number>((resolve) => {
        resolveFirst = resolve;
      }));

      const { fetchBtcPrice } = usePriceStore.getState();
      let firstFetchPromise: Promise<void>;

      act(() => { firstFetchPromise = fetchBtcPrice(); });
      await act(async () => { await fetchBtcPrice(); }); // Should return immediately

      expect(mockFetchBtcPrice).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveFirst!(50000);
        await firstFetchPromise;
      });
    });
  });

  describe('setFallbackBtcPrice', () => {
    it('should seed btcPrice from a valid fallback when no price is loaded', () => {
      const { setFallbackBtcPrice } = usePriceStore.getState();

      act(() => { setFallbackBtcPrice(51000); });

      expect(usePriceStore.getState().btcPrice).toBe(51000);
      expect(usePriceStore.getState().lastFetchTime).not.toBeNull();
    });

    it('should not overwrite an existing primary price with fallback data', async () => {
      mockFetchBtcPrice.mockResolvedValueOnce(50000);
      const { fetchBtcPrice, setFallbackBtcPrice } = usePriceStore.getState();

      await act(async () => { await fetchBtcPrice(); });
      act(() => { setFallbackBtcPrice(49000); });

      expect(usePriceStore.getState().btcPrice).toBe(50000);
    });

    it('should ignore invalid fallback prices', () => {
      const { setFallbackBtcPrice } = usePriceStore.getState();

      act(() => { setFallbackBtcPrice(0); });

      expect(usePriceStore.getState().btcPrice).toBeNull();
    });
  });

  describe('startAutoRefresh', () => {
    it('should fetch immediately and then every 60 seconds', async () => {
      mockFetchBtcPrice.mockResolvedValue(50000);
      const { startAutoRefresh } = usePriceStore.getState();

      await act(async () => {
        startAutoRefresh();
        await Promise.resolve();
      });
      expect(mockFetchBtcPrice).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(60000);
        await Promise.resolve();
      });
      expect(mockFetchBtcPrice).toHaveBeenCalledTimes(2);
    });

    it('should return cleanup function that stops refresh', async () => {
      mockFetchBtcPrice.mockResolvedValue(50000);
      const { startAutoRefresh } = usePriceStore.getState();

      let cleanup: () => void;
      await act(async () => {
        cleanup = startAutoRefresh();
        await Promise.resolve();
      });

      act(() => { cleanup(); });

      await act(async () => {
        jest.advanceTimersByTime(60000);
        await Promise.resolve();
      });
      expect(mockFetchBtcPrice).toHaveBeenCalledTimes(1);
    });

    it('should clear existing interval when called again', async () => {
      mockFetchBtcPrice.mockResolvedValue(50000);
      const { startAutoRefresh } = usePriceStore.getState();

      await act(async () => {
        startAutoRefresh();
        await Promise.resolve();
      });

      await act(async () => {
        startAutoRefresh();
        await Promise.resolve();
      });

      // After 60s, should only trigger one fetch (not two)
      await act(async () => {
        jest.advanceTimersByTime(60000);
        await Promise.resolve();
      });
      expect(mockFetchBtcPrice).toHaveBeenCalledTimes(3); // 2 immediate + 1 interval
    });
  });

  it('should reset all state and clear auto-refresh interval', async () => {
    mockFetchBtcPrice.mockResolvedValue(50000);
    const { fetchBtcPrice, startAutoRefresh } = usePriceStore.getState();

    await act(async () => { await fetchBtcPrice(); });
    await act(async () => {
      startAutoRefresh();
      await Promise.resolve();
    });

    act(() => { resetPriceStore(); });

      expect(usePriceStore.getState()).toMatchObject({
        btcPrice: null,
        ethPrice: null,
        loadingBtcPrice: false,
        loadingEthPrice: false,
        lastFetchTime: null,
      });

    // Interval should be cleared
    await act(async () => {
      jest.advanceTimersByTime(60000);
      await Promise.resolve();
    });
    expect(mockFetchBtcPrice).toHaveBeenCalledTimes(2); // No additional calls
  });
});
