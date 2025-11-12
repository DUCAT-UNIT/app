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

  it('should initialize with polling functions', () => {
    const { result } = renderHook(() => useTransactionPolling());

    expect(result.current.startPolling).toBeDefined();
    expect(result.current.stopPolling).toBeDefined();
    expect(typeof result.current.startPolling).toBe('function');
    expect(typeof result.current.stopPolling).toBe('function');
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

  it('should clean up interval on unmount', () => {
    const { result, unmount } = renderHook(() => useTransactionPolling());

    act(() => {
      result.current.startPolling('test-txid', jest.fn());
    });

    expect(() => unmount()).not.toThrow();
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
});
