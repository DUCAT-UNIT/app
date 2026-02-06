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
jest.mock('../../services/balanceService', () => ({
  fetchBtcPrice: () => mockFetchBtcPrice(),
}));

describe('priceStore', () => {
  beforeEach(() => {
    resetPriceStore();
    jest.useFakeTimers();
    mockFetchBtcPrice.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should have correct initial state', () => {
    const state = usePriceStore.getState();
    expect(state).toMatchObject({
      btcPrice: null,
      loadingBtcPrice: false,
      lastFetchTime: null,
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

    it('should set btcPrice to null on error', async () => {
      mockFetchBtcPrice.mockRejectedValueOnce(new Error('Network error'));
      const { fetchBtcPrice } = usePriceStore.getState();

      await act(async () => { await fetchBtcPrice(); });

      expect(usePriceStore.getState().btcPrice).toBeNull();
      expect(usePriceStore.getState().loadingBtcPrice).toBe(false);
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
      loadingBtcPrice: false,
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
