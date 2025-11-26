// @ts-nocheck
/**
 * Tests for useTransactionPolling Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useTransactionPolling } from '../useTransactionPolling';
import * as constants from '../../utils/constants';

// Helper to render hooks
function renderHook(hook) {
  const result = { current: null };
  function TestComponent() {
    result.current = hook();
    return null;
  }
  let component;
  act(() => {
    component = create(<TestComponent />);
  });
  return { result, unmount: () => component.unmount() };
}

// Mock fetch
global.fetch = jest.fn();

// Mock timers
jest.useFakeTimers();

// Mock constants
jest.mock('../../utils/constants', () => ({
  getTxApiUrl: jest.fn((txid) => `https://api.test/tx/${txid}`),
}));

describe('useTransactionPolling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should poll for transaction confirmation', async () => {
    const { result } = renderHook(() => useTransactionPolling());
    const onConfirmed = jest.fn();

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: { confirmed: true } }),
    });

    act(() => {
      result.current.startPolling('test-txid', onConfirmed);
    });

    // Wait for first poll (5 seconds)
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve(); // Let fetch resolve
    });

    expect(global.fetch).toHaveBeenCalledWith('https://api.test/tx/test-txid');
    expect(onConfirmed).toHaveBeenCalledWith(true);
  });

  it('should stop polling after confirmation', async () => {
    const { result } = renderHook(() => useTransactionPolling());
    const onConfirmed = jest.fn();

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: { confirmed: true } }),
    });

    act(() => {
      result.current.startPolling('test-txid', onConfirmed);
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(onConfirmed).toHaveBeenCalledTimes(1);

    // Advance more time - should not poll again
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });

    expect(onConfirmed).toHaveBeenCalledTimes(1); // Still only called once
  });

  it('should call onError when fetch fails', async () => {
    const { result } = renderHook(() => useTransactionPolling());
    const onConfirmed = jest.fn();
    const onError = jest.fn();

    global.fetch.mockRejectedValue(new Error('Network error'));

    act(() => {
      result.current.startPolling('test-txid', onConfirmed, onError);
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(onError).toHaveBeenCalled();
  });

  it('should stop polling manually', async () => {
    const { result } = renderHook(() => useTransactionPolling());
    const onConfirmed = jest.fn();

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: { confirmed: false } }),
    });

    act(() => {
      result.current.startPolling('test-txid', onConfirmed);
    });

    // Stop before first poll
    act(() => {
      result.current.stopPolling();
    });

    await act(async () => {
      jest.advanceTimersByTime(10000);
    });

    expect(onConfirmed).not.toHaveBeenCalled();
  });


  it('should handle unconfirmed transactions', async () => {
    const { result } = renderHook(() => useTransactionPolling());
    const onConfirmed = jest.fn();

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: { confirmed: false } }),
    });

    act(() => {
      result.current.startPolling('test-txid', onConfirmed);
    });

    // First poll - not confirmed
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(onConfirmed).not.toHaveBeenCalled();

    // Second poll - still not confirmed
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it('should handle HTTP error responses', async () => {
    const { result } = renderHook(() => useTransactionPolling());
    const onConfirmed = jest.fn();
    const onError = jest.fn();

    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
    });

    act(() => {
      result.current.startPolling('test-txid', onConfirmed, onError);
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError.mock.calls[0][0].message).toBe('Failed to fetch transaction status');
  });

  it('should clear existing interval when starting new poll', async () => {
    const { result } = renderHook(() => useTransactionPolling());
    const onConfirmed1 = jest.fn();
    const onConfirmed2 = jest.fn();

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: { confirmed: false } }),
    });

    // Start first poll
    act(() => {
      result.current.startPolling('txid-1', onConfirmed1);
    });

    // Start second poll immediately (should clear first)
    act(() => {
      result.current.startPolling('txid-2', onConfirmed2);
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    // Only second poll should be called
    expect(global.fetch).toHaveBeenCalledWith('https://api.test/tx/txid-2');
    expect(global.fetch).not.toHaveBeenCalledWith('https://api.test/tx/txid-1');
  });

  it('should reach max attempts and call onConfirmed with false', async () => {
    const { result } = renderHook(() => useTransactionPolling());
    const onConfirmed = jest.fn();

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: { confirmed: false } }),
    });

    act(() => {
      result.current.startPolling('test-txid', onConfirmed);
    });

    // Advance through all 60 attempts (60 * 5 seconds = 300 seconds)
    for (let i = 0; i < 60; i++) {
      await act(async () => {
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
      });
    }

    expect(onConfirmed).toHaveBeenCalledWith(false);
  });

  it('should handle onError being undefined', async () => {
    const { result } = renderHook(() => useTransactionPolling());
    const onConfirmed = jest.fn();

    global.fetch.mockRejectedValue(new Error('Network error'));

    act(() => {
      result.current.startPolling('test-txid', onConfirmed);
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    // Should not throw when onError is undefined
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it('should handle onConfirmed being undefined', async () => {
    const { result } = renderHook(() => useTransactionPolling());

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: { confirmed: true } }),
    });

    act(() => {
      result.current.startPolling('test-txid');
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    // Should not throw when onConfirmed is undefined
    expect(global.fetch).toHaveBeenCalled();
  });

  it('should handle stopPolling when no polling is active', () => {
    const { result } = renderHook(() => useTransactionPolling());

    // Call stopPolling without starting any poll
    act(() => {
      result.current.stopPolling();
    });

    // Should not throw
    expect(result.current).toBeDefined();
  });

  it('should clear interval on unmount while polling is active', async () => {
    const { result, unmount } = renderHook(() => useTransactionPolling());
    const onConfirmed = jest.fn();

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: { confirmed: false } }),
    });

    act(() => {
      result.current.startPolling('test-txid', onConfirmed);
    });

    // Unmount while polling is still active
    act(() => {
      unmount();
    });

    // Advance timers - polling should not continue after unmount
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });

    // Callback should not have been called since we unmounted
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it('should handle unmount when no polling was started', () => {
    const { unmount } = renderHook(() => useTransactionPolling());

    // Unmount without starting any poll
    act(() => {
      unmount();
    });

    // Should not throw - cleanup handles null pollIntervalRef gracefully
  });
});
