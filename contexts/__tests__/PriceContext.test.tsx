/**
 * Tests for PriceContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { usePrice, usePriceStore } from '../../stores/priceStore';
import * as balanceService from '../../services/balanceService';
import { resetPriceStore } from '../../stores';

// No-op provider for backwards compatibility (Zustand stores don't need providers)
const PriceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;

// Helper to render hooks with react-test-renderer
function renderHook<T>(hook: () => T, { wrapper: Wrapper }: { wrapper?: React.ComponentType<{ children: React.ReactNode }> } = {}) {
  const result: { current: T | null } = { current: null };

  function TestComponent() {
    result.current = hook();
    return null;
  }

  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = Wrapper
      ? create(<Wrapper><TestComponent /></Wrapper>)
      : create(<TestComponent />);
  });

  return { result, rerender: component!.update, unmount: component!.unmount };
}

// Mock dependencies
jest.mock('../../services/balanceService');

describe('PriceContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    // Reset Zustand store state between tests
    resetPriceStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should work without provider (Zustand stores are globally accessible)', () => {
    // Zustand stores don't require providers - they're globally accessible
    const { result } = renderHook(() => usePrice());

    expect(result.current!.btcPrice).toBe(null);
    expect(result.current!.fetchBtcPrice).toBeDefined();
  });

  it('should provide initial state', async () => {
    (balanceService.fetchBtcPrice as jest.Mock).mockResolvedValue(null);

    const wrapper = ({ children }: { children: React.ReactNode }) => <PriceProvider>{children}</PriceProvider>;
    const { result } = renderHook(() => usePrice(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current!.btcPrice).toBe(null);
    expect(result.current!.loadingBtcPrice).toBe(false);
  });

  it('should fetch BTC price on mount', async () => {
    const mockPrice = 50000;
    (balanceService.fetchBtcPrice as jest.Mock).mockResolvedValue(mockPrice);

    const wrapper = ({ children }: { children: React.ReactNode }) => <PriceProvider>{children}</PriceProvider>;
    const { result } = renderHook(() => usePrice(), { wrapper });

    // Zustand stores don't auto-fetch on mount - need to call startAutoRefresh explicitly
    await act(async () => {
      usePriceStore.getState().startAutoRefresh();
      await Promise.resolve();
    });

    expect(balanceService.fetchBtcPrice).toHaveBeenCalledTimes(1);
    expect(result.current!.btcPrice).toBe(mockPrice);
    expect(result.current!.loadingBtcPrice).toBe(false);
  });

  it('should auto-refresh price every 60 seconds', async () => {
    const mockPrice = 50000;
    (balanceService.fetchBtcPrice as jest.Mock).mockResolvedValue(mockPrice);

    const wrapper = ({ children }: { children: React.ReactNode }) => <PriceProvider>{children}</PriceProvider>;
    renderHook(() => usePrice(), { wrapper });

    // Start auto-refresh (this does initial fetch + starts interval)
    await act(async () => {
      usePriceStore.getState().startAutoRefresh();
      await Promise.resolve();
    });

    expect(balanceService.fetchBtcPrice).toHaveBeenCalledTimes(1);

    // Advance 60 seconds
    await act(async () => {
      jest.advanceTimersByTime(60000);
      await Promise.resolve();
    });

    expect(balanceService.fetchBtcPrice).toHaveBeenCalledTimes(2);

    // Advance another 60 seconds
    await act(async () => {
      jest.advanceTimersByTime(60000);
      await Promise.resolve();
    });

    expect(balanceService.fetchBtcPrice).toHaveBeenCalledTimes(3);
  });

  it('should handle fetchBtcPrice errors gracefully', async () => {
    (balanceService.fetchBtcPrice as jest.Mock).mockRejectedValue(new Error('Network error'));

    const wrapper = ({ children }: { children: React.ReactNode }) => <PriceProvider>{children}</PriceProvider>;
    const { result } = renderHook(() => usePrice(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    // Should set price to null on error
    expect(result.current!.btcPrice).toBe(null);
    expect(result.current!.loadingBtcPrice).toBe(false);
  });

  it('should manually fetch BTC price', async () => {
    const mockPrice = 50000;
    const newPrice = 51000;
    (balanceService.fetchBtcPrice as jest.Mock)
      .mockResolvedValueOnce(mockPrice)
      .mockResolvedValueOnce(newPrice);

    const wrapper = ({ children }: { children: React.ReactNode }) => <PriceProvider>{children}</PriceProvider>;
    const { result } = renderHook(() => usePrice(), { wrapper });

    // Manual fetch (no auto-fetch on mount in Zustand)
    await act(async () => {
      await result.current!.fetchBtcPrice();
    });

    expect(result.current!.btcPrice).toBe(mockPrice);

    // Another manual fetch
    await act(async () => {
      await result.current!.fetchBtcPrice();
    });

    expect(balanceService.fetchBtcPrice).toHaveBeenCalledTimes(2);
    expect(result.current!.btcPrice).toBe(newPrice);
  });

  it('should set loading state during fetch', async () => {
    let resolvePrice: (value: number) => void;
    const pricePromise = new Promise<number>((resolve) => {
      resolvePrice = resolve;
    });
    (balanceService.fetchBtcPrice as jest.Mock).mockReturnValue(pricePromise);

    const wrapper = ({ children }: { children: React.ReactNode }) => <PriceProvider>{children}</PriceProvider>;
    const { result } = renderHook(() => usePrice(), { wrapper });

    // Start fetch manually (no auto-fetch in Zustand)
    act(() => {
      result.current!.fetchBtcPrice();
    });

    // Should be loading while promise is pending
    expect(result.current!.loadingBtcPrice).toBe(true);

    // Resolve the promise
    await act(async () => {
      resolvePrice(50000);
      await pricePromise;
    });

    expect(result.current!.loadingBtcPrice).toBe(false);
    expect(result.current!.btcPrice).toBe(50000);
  });

  it('should cleanup interval on unmount', async () => {
    const mockPrice = 50000;
    (balanceService.fetchBtcPrice as jest.Mock).mockResolvedValue(mockPrice);

    const wrapper = ({ children }: { children: React.ReactNode }) => <PriceProvider>{children}</PriceProvider>;
    const { unmount } = renderHook(() => usePrice(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    const callCount = (balanceService.fetchBtcPrice as jest.Mock).mock.calls.length;

    // Unmount
    act(() => {
      unmount();
    });

    // Advance time
    await act(async () => {
      jest.advanceTimersByTime(60000);
      await Promise.resolve();
    });

    // Should not have called again after unmount
    expect(balanceService.fetchBtcPrice).toHaveBeenCalledTimes(callCount);
  });
});
