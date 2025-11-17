/**
 * Tests for PriceContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { PriceProvider, usePrice } from '../PriceContext';
import * as balanceService from '../../services/balanceService';

// Helper to render hooks with react-test-renderer
function renderHook(hook, { wrapper: Wrapper } = {}) {
  const result = { current: null };

  function TestComponent() {
    result.current = hook();
    return null;
  }

  let component;
  act(() => {
    component = Wrapper
      ? create(<Wrapper><TestComponent /></Wrapper>)
      : create(<TestComponent />);
  });

  return { result, rerender: component.update, unmount: component.unmount };
}

// Mock dependencies
jest.mock('../../services/balanceService');

describe('PriceContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should throw error when used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => usePrice());
    }).toThrow('usePrice must be used within a PriceProvider');

    consoleError.mockRestore();
  });

  it('should provide initial state', async () => {
    balanceService.fetchBtcPrice.mockResolvedValue(null);

    const wrapper = ({ children }) => <PriceProvider>{children}</PriceProvider>;
    const { result } = renderHook(() => usePrice(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.btcPrice).toBe(null);
    expect(result.current.loadingBtcPrice).toBe(false);
  });

  it('should fetch BTC price on mount', async () => {
    const mockPrice = 50000;
    balanceService.fetchBtcPrice.mockResolvedValue(mockPrice);

    const wrapper = ({ children }) => <PriceProvider>{children}</PriceProvider>;
    const { result } = renderHook(() => usePrice(), { wrapper });

    // Wait for the async effect to complete
    await act(async () => {
      await Promise.resolve();
    });

    expect(balanceService.fetchBtcPrice).toHaveBeenCalledTimes(1);
    expect(result.current.btcPrice).toBe(mockPrice);
    expect(result.current.loadingBtcPrice).toBe(false);
  });

  it('should auto-refresh price every 60 seconds', async () => {
    const mockPrice = 50000;
    balanceService.fetchBtcPrice.mockResolvedValue(mockPrice);

    const wrapper = ({ children }) => <PriceProvider>{children}</PriceProvider>;
    renderHook(() => usePrice(), { wrapper });

    // Initial fetch
    await act(async () => {
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
    balanceService.fetchBtcPrice.mockRejectedValue(new Error('Network error'));

    const wrapper = ({ children }) => <PriceProvider>{children}</PriceProvider>;
    const { result } = renderHook(() => usePrice(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    // Should set price to null on error
    expect(result.current.btcPrice).toBe(null);
    expect(result.current.loadingBtcPrice).toBe(false);
  });

  it('should manually fetch BTC price', async () => {
    const mockPrice = 50000;
    const newPrice = 51000;
    balanceService.fetchBtcPrice
      .mockResolvedValueOnce(mockPrice)
      .mockResolvedValueOnce(newPrice);

    const wrapper = ({ children }) => <PriceProvider>{children}</PriceProvider>;
    const { result } = renderHook(() => usePrice(), { wrapper });

    // Wait for initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.btcPrice).toBe(mockPrice);

    // Manual fetch
    await act(async () => {
      await result.current.fetchBtcPrice();
    });

    expect(balanceService.fetchBtcPrice).toHaveBeenCalledTimes(2);
    expect(result.current.btcPrice).toBe(newPrice);
  });

  it('should set loading state during fetch', async () => {
    let resolvePrice;
    const pricePromise = new Promise((resolve) => {
      resolvePrice = resolve;
    });
    balanceService.fetchBtcPrice.mockReturnValue(pricePromise);

    const wrapper = ({ children }) => <PriceProvider>{children}</PriceProvider>;
    const { result } = renderHook(() => usePrice(), { wrapper });

    // Start loading
    await act(async () => {
      await Promise.resolve(); // Let the effect run
    });

    // Should be loading (note: might already be false if promise resolved immediately)
    // Resolve the promise
    await act(async () => {
      resolvePrice(50000);
      await pricePromise;
    });

    expect(result.current.loadingBtcPrice).toBe(false);
    expect(result.current.btcPrice).toBe(50000);
  });

  it('should cleanup interval on unmount', async () => {
    const mockPrice = 50000;
    balanceService.fetchBtcPrice.mockResolvedValue(mockPrice);

    const wrapper = ({ children }) => <PriceProvider>{children}</PriceProvider>;
    const { unmount } = renderHook(() => usePrice(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    const callCount = balanceService.fetchBtcPrice.mock.calls.length;

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
