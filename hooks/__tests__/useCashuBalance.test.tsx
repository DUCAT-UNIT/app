/**
 * Tests for useCashuBalance hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useCashuBalance } from '../useCashuBalance';
import type { WalletAddresses } from '../../contexts/WalletContext';

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
  subscribeToProofChanges: jest.fn(() => jest.fn()), // Returns unsubscribe function
}));

jest.mock('../usePolling', () => ({
  usePolling: jest.fn(),
}));

import { getBalance, setCurrentAccount, subscribeToProofChanges } from '../../services/cashu/cashuWalletService';
import { usePolling } from '../usePolling';
import { logger } from '../../utils/logger';

const mockGetBalance = getBalance as jest.Mock;
const mockSetCurrentAccount = setCurrentAccount as jest.Mock;

// Helper to render hooks
function renderHook<T>(hook: () => T) {
  const result: { current: T | null } = { current: null };
  function TestComponent() {
    result.current = hook();
    return null;
  }
  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(<TestComponent />);
  });
  return { result, unmount: component!.unmount, component };
}

describe('useCashuBalance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Use mockReset to clear both call history AND implementation queue
    mockGetBalance.mockReset();
    mockGetBalance.mockResolvedValue(100);
    mockSetCurrentAccount.mockResolvedValue(undefined);
    (usePolling as jest.Mock).mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useCashuBalance({ wallet: null }));

    expect(result.current!.balance).toBe(0);
    expect(result.current!.error).toBe(null);
    expect(typeof result.current!.fetchBalance).toBe('function');
    expect(typeof result.current!.setBalance).toBe('function');
    expect(typeof result.current!.setError).toBe('function');
  });

  it('should call setCurrentAccount when wallet changes', async () => {
    const wallet = { taprootAddress: 'tb1p123...', segwitAddress: 'bc1q...', segwitPubkey: 'pub1', taprootPubkey: 'pub2' } as WalletAddresses;

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

  it('should fetch balance on initial load when wallet exists', async () => {
    const wallet = { taprootAddress: 'tb1p123...', segwitAddress: 'bc1q...', segwitPubkey: 'pub1', taprootPubkey: 'pub2' } as WalletAddresses;

    await act(async () => {
      renderHook(() => useCashuBalance({ wallet }));
      await Promise.resolve();
      await Promise.resolve(); // Allow async initAccount to run
    });

    expect(getBalance).toHaveBeenCalledWith(false);
  });

  it('should handle fetchBalance with fullLoad=true', async () => {
    mockGetBalance.mockResolvedValue(500);
    const { result } = renderHook(() => useCashuBalance({ wallet: null }));

    let returnedBalance;
    await act(async () => {
      returnedBalance = await result.current!.fetchBalance(true);
    });

    expect(getBalance).toHaveBeenCalledWith(true);
    expect(returnedBalance).toBe(500);
    expect(result.current!.balance).toBe(500);
    expect(result.current!.error).toBe(null);
  });

  it('should handle fetchBalance with fullLoad=false', async () => {
    // Clear previous mocks and set fresh sequence
    mockGetBalance.mockReset();
    mockGetBalance.mockResolvedValueOnce(50).mockResolvedValueOnce(100);

    const { result } = renderHook(() => useCashuBalance({ wallet: null }));

    // Wait for initial effect to run
    await act(async () => {
      await Promise.resolve();
    });

    // Reset mocks to clear both call history and implementation queue
    mockGetBalance.mockReset();
    mockGetBalance.mockResolvedValueOnce(50).mockResolvedValueOnce(100);

    let returnedBalance;
    await act(async () => {
      returnedBalance = await result.current!.fetchBalance(false);
    });

    expect(getBalance).toHaveBeenCalledWith(false);
    expect(returnedBalance).toBe(50);
  });

  it('should handle fetchBalance errors', async () => {
    mockGetBalance.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useCashuBalance({ wallet: null }));

    await act(async () => {
      await result.current!.fetchBalance(true);
    });

    expect(result.current!.error).toBe('Network error');
  });

  it('should handle non-Error thrown from fetchBalance', async () => {
    mockGetBalance.mockRejectedValue('string error');
    const { result } = renderHook(() => useCashuBalance({ wallet: null }));

    await act(async () => {
      await result.current!.fetchBalance(true);
    });

    expect(result.current!.error).toBe('string error');
    expect(logger.error).toHaveBeenCalledWith('Failed to fetch Cashu balance', { error: 'string error' });
  });

  it('should handle fetchBalance with default fullLoad parameter', async () => {
    mockGetBalance.mockResolvedValue(300);
    const { result } = renderHook(() => useCashuBalance({ wallet: null }));

    let returnedBalance;
    await act(async () => {
      // Call without argument - should default to fullLoad=true
      returnedBalance = await result.current!.fetchBalance();
    });

    expect(getBalance).toHaveBeenCalledWith(true);
    expect(returnedBalance).toBe(300);
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
    mockGetBalance.mockResolvedValueOnce(25).mockResolvedValueOnce(100);
    const { result } = renderHook(() => useCashuBalance({ wallet: null }));

    await act(async () => {
      await result.current!.fetchBalance(false);
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
    mockGetBalance.mockResolvedValueOnce(25).mockRejectedValueOnce(new Error('Background error'));
    const { result } = renderHook(() => useCashuBalance({ wallet: null }));

    // Reset mocks to clear both call history and implementation queue
    mockGetBalance.mockReset();
    mockGetBalance.mockResolvedValueOnce(25).mockRejectedValueOnce(new Error('Background error'));

    await act(async () => {
      await result.current!.fetchBalance(false);
    });

    // Advance timer for background load
    await act(async () => {
      jest.advanceTimersByTime(200);
      await Promise.resolve();
    });

    // Should not throw, balance should still be set from quick load
    expect(result.current!.error).toBe(null);
    expect(logger.error).toHaveBeenCalledWith('Failed to fetch full Cashu balance', { error: 'Background error' });
  });

  it('should handle non-Error thrown during background fetch', async () => {
    const { result } = renderHook(() => useCashuBalance({ wallet: null }));

    // Reset mocks
    mockGetBalance.mockReset();
    mockGetBalance.mockResolvedValueOnce(25).mockRejectedValueOnce('background string error');

    await act(async () => {
      await result.current!.fetchBalance(false);
    });

    // Advance timer for background load
    await act(async () => {
      jest.advanceTimersByTime(200);
      await Promise.resolve();
    });

    expect(logger.error).toHaveBeenCalledWith('Failed to fetch full Cashu balance', { error: 'background string error' });
  });

  it('should return current balance on fetch error', async () => {
    mockGetBalance.mockResolvedValue(200);
    const { result } = renderHook(() => useCashuBalance({ wallet: null }));

    // Wait for initial balance to be set
    await act(async () => {
      await result.current!.fetchBalance(true);
    });

    expect(result.current!.balance).toBe(200);

    // Make next fetch fail
    mockGetBalance.mockRejectedValue(new Error('Failed'));

    let returnedBalance;
    await act(async () => {
      returnedBalance = await result.current!.fetchBalance(true);
    });

    // Should return current balance on error
    expect(returnedBalance).toBe(200);
    expect(result.current!.error).toBe('Failed');
  });

  describe('subscribeToProofChanges', () => {
    it('should refresh balance when proof change callback is invoked', async () => {
      let capturedCallback: (() => void) | null = null;
      const mockUnsubscribe = jest.fn();
      (subscribeToProofChanges as jest.Mock).mockImplementation((callback) => {
        capturedCallback = callback;
        return mockUnsubscribe;
      });

      mockGetBalance.mockReset();
      mockGetBalance.mockResolvedValue(100);

      const { result } = renderHook(() => useCashuBalance({ wallet: null }));

      // Verify subscribeToProofChanges was called
      expect(subscribeToProofChanges).toHaveBeenCalled();
      expect(capturedCallback).not.toBeNull();

      // Reset getBalance to track the callback call
      mockGetBalance.mockReset();
      mockGetBalance.mockResolvedValue(200);

      // Invoke the callback (simulating a proof change)
      await act(async () => {
        capturedCallback!();
        await Promise.resolve();
      });

      // Should call fetchBalance(true) - full load
      expect(getBalance).toHaveBeenCalledWith(true);
      expect(logger.debug).toHaveBeenCalledWith('[useCashuBalance] Proof change detected, refreshing balance');
    });

    it('should call unsubscribe on unmount', async () => {
      const mockUnsubscribe = jest.fn();
      (subscribeToProofChanges as jest.Mock).mockImplementation(() => mockUnsubscribe);

      const { unmount } = renderHook(() => useCashuBalance({ wallet: null }));

      await act(async () => {
        await Promise.resolve();
      });

      // Unmount the hook
      act(() => {
        unmount();
      });

      // Verify unsubscribe was called
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});
