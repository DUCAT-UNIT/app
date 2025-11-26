// @ts-nocheck
/**
 * Tests for useCashuBalance hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useCashuBalance } from '../useCashuBalance';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../services/cashu/cashuWalletService', () => ({
  getBalance: jest.fn(),
  setCurrentAccount: jest.fn(),
}));

jest.mock('../usePolling', () => ({
  usePolling: jest.fn(),
}));

import { getBalance, setCurrentAccount } from '../../services/cashu/cashuWalletService';
import { usePolling } from '../usePolling';

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
  return { result, unmount: component.unmount, component };
}

describe('useCashuBalance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Use mockReset to clear both call history AND implementation queue
    getBalance.mockReset();
    getBalance.mockResolvedValue(100);
    setCurrentAccount.mockResolvedValue();
    usePolling.mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useCashuBalance({ wallet: null }));

    expect(result.current.balance).toBe(0);
    expect(result.current.error).toBe(null);
    expect(typeof result.current.fetchBalance).toBe('function');
    expect(typeof result.current.setBalance).toBe('function');
    expect(typeof result.current.setError).toBe('function');
  });

  it('should call setCurrentAccount when wallet changes', async () => {
    const wallet = { taprootAddress: 'tb1p123...' };

    await act(async () => {
      renderHook(() => useCashuBalance({ wallet }));
      await Promise.resolve();
    });

    expect(setCurrentAccount).toHaveBeenCalledWith('tb1p123...');
  });

  it('should not call setCurrentAccount when wallet is null', async () => {
    await act(async () => {
      renderHook(() => useCashuBalance({ wallet: null }));
      await Promise.resolve();
    });

    expect(setCurrentAccount).not.toHaveBeenCalled();
  });

  it('should fetch balance on initial load', async () => {
    const { result } = renderHook(() => useCashuBalance({ wallet: null }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(getBalance).toHaveBeenCalledWith(false);
  });

  it('should handle fetchBalance with fullLoad=true', async () => {
    getBalance.mockResolvedValue(500);
    const { result } = renderHook(() => useCashuBalance({ wallet: null }));

    let returnedBalance;
    await act(async () => {
      returnedBalance = await result.current.fetchBalance(true);
    });

    expect(getBalance).toHaveBeenCalledWith(true);
    expect(returnedBalance).toBe(500);
    expect(result.current.balance).toBe(500);
    expect(result.current.error).toBe(null);
  });

  it('should handle fetchBalance with fullLoad=false', async () => {
    // Clear previous mocks and set fresh sequence
    getBalance.mockReset();
    getBalance.mockResolvedValueOnce(50).mockResolvedValueOnce(100);

    const { result } = renderHook(() => useCashuBalance({ wallet: null }));

    // Wait for initial effect to run
    await act(async () => {
      await Promise.resolve();
    });

    // Reset mocks to clear both call history and implementation queue
    getBalance.mockReset();
    getBalance.mockResolvedValueOnce(50).mockResolvedValueOnce(100);

    let returnedBalance;
    await act(async () => {
      returnedBalance = await result.current.fetchBalance(false);
    });

    expect(getBalance).toHaveBeenCalledWith(false);
    expect(returnedBalance).toBe(50);
  });

  it('should handle fetchBalance errors', async () => {
    getBalance.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useCashuBalance({ wallet: null }));

    await act(async () => {
      await result.current.fetchBalance(true);
    });

    expect(result.current.error).toBe('Network error');
  });

  it('should setup polling with usePolling', () => {
    renderHook(() => useCashuBalance({ wallet: null }));

    expect(usePolling).toHaveBeenCalledWith(
      expect.objectContaining({
        interval: 10000,
        enabled: true,
        immediate: false,
      })
    );
  });

  it('should load full balance in background after quick load', async () => {
    getBalance.mockResolvedValueOnce(25).mockResolvedValueOnce(100);
    const { result } = renderHook(() => useCashuBalance({ wallet: null }));

    await act(async () => {
      await result.current.fetchBalance(false);
    });

    // First call with false (quick load)
    expect(getBalance).toHaveBeenCalledWith(false);

    // Advance timer for background load
    await act(async () => {
      jest.advanceTimersByTime(200);
      await Promise.resolve();
    });

    // Background load with true (full load)
    expect(getBalance).toHaveBeenCalledWith(true);
  });

  it('should handle background fetch error gracefully', async () => {
    getBalance.mockResolvedValueOnce(25).mockRejectedValueOnce(new Error('Background error'));
    const { result } = renderHook(() => useCashuBalance({ wallet: null }));

    // Reset mocks to clear both call history and implementation queue
    getBalance.mockReset();
    getBalance.mockResolvedValueOnce(25).mockRejectedValueOnce(new Error('Background error'));

    await act(async () => {
      await result.current.fetchBalance(false);
    });

    // Advance timer for background load
    await act(async () => {
      jest.advanceTimersByTime(200);
      await Promise.resolve();
    });

    // Should not throw, balance should still be set from quick load
    expect(result.current.error).toBe(null);
  });

  it('should return current balance on fetch error', async () => {
    getBalance.mockResolvedValue(200);
    const { result } = renderHook(() => useCashuBalance({ wallet: null }));

    // Wait for initial balance to be set
    await act(async () => {
      await result.current.fetchBalance(true);
    });

    expect(result.current.balance).toBe(200);

    // Make next fetch fail
    getBalance.mockRejectedValue(new Error('Failed'));

    let returnedBalance;
    await act(async () => {
      returnedBalance = await result.current.fetchBalance(true);
    });

    // Should return current balance on error
    expect(returnedBalance).toBe(200);
    expect(result.current.error).toBe('Failed');
  });
});
