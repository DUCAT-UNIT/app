// @ts-nocheck
/**
 * Tests for useCashuMint hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useCashuMint } from '../useCashuMint';

// Mock dependencies
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    cashu: jest.fn(),
  },
}));

jest.mock('../../services/cashu/cashuWalletService', () => ({
  requestMint: jest.fn(),
  checkMintStatus: jest.fn(),
  completeMint: jest.fn(),
}));

jest.mock('../usePolling', () => ({
  usePolling: jest.fn(),
}));

import { Alert } from 'react-native';
import { requestMint, checkMintStatus, completeMint } from '../../services/cashu/cashuWalletService';
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

describe('useCashuMint', () => {
  let fetchBalance;
  let setIsLoading;
  let setError;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchBalance = jest.fn().mockResolvedValue();
    setIsLoading = jest.fn();
    setError = jest.fn();
    usePolling.mockImplementation(() => {});
    requestMint.mockResolvedValue({
      quoteId: 'quote123',
      amount: 100,
      depositAddress: 'tb1p...',
    });
    checkMintStatus.mockResolvedValue({ paid: false, state: 'UNPAID' });
    completeMint.mockResolvedValue([{ id: 'proof1' }, { id: 'proof2' }]);
  });

  it('should return expected functions and state', () => {
    const { result } = renderHook(() =>
      useCashuMint({ fetchBalance, setIsLoading, setError })
    );

    expect(result.current.pendingMints).toEqual([]);
    expect(typeof result.current.startMint).toBe('function');
    expect(typeof result.current.checkAndCompleteMint).toBe('function');
    expect(typeof result.current.removePendingMint).toBe('function');
    expect(typeof result.current.autoMint).toBe('function');
    expect(typeof result.current.setPendingMints).toBe('function');
  });

  describe('startMint', () => {
    it('should request mint and add to pending', async () => {
      const { result } = renderHook(() =>
        useCashuMint({ fetchBalance, setIsLoading, setError })
      );

      let quote;
      await act(async () => {
        quote = await result.current.startMint(100);
      });

      expect(setIsLoading).toHaveBeenCalledWith(true);
      expect(setError).toHaveBeenCalledWith(null);
      expect(requestMint).toHaveBeenCalledWith(100);
      expect(quote.quoteId).toBe('quote123');
      expect(result.current.pendingMints.length).toBe(1);
      expect(result.current.pendingMints[0].quoteId).toBe('quote123');
      expect(setIsLoading).toHaveBeenLastCalledWith(false);
    });

    it('should handle start mint error', async () => {
      requestMint.mockRejectedValue(new Error('Mint request failed'));

      const { result } = renderHook(() =>
        useCashuMint({ fetchBalance, setIsLoading, setError })
      );

      await expect(
        act(async () => {
          await result.current.startMint(100);
        })
      ).rejects.toThrow('Mint request failed');

      expect(setError).toHaveBeenCalledWith('Mint request failed');
      expect(setIsLoading).toHaveBeenLastCalledWith(false);
    });
  });

  describe('checkAndCompleteMint', () => {
    it('should return not completed when not paid', async () => {
      const { result } = renderHook(() =>
        useCashuMint({ fetchBalance, setIsLoading, setError })
      );

      // First add a pending mint
      await act(async () => {
        await result.current.startMint(100);
      });

      let status;
      await act(async () => {
        status = await result.current.checkAndCompleteMint('quote123');
      });

      expect(status.completed).toBe(false);
      expect(status.state).toBe('UNPAID');
    });

    it('should complete mint when paid', async () => {
      checkMintStatus.mockResolvedValue({ paid: true, state: 'PAID' });

      const { result } = renderHook(() =>
        useCashuMint({ fetchBalance, setIsLoading, setError })
      );

      // First add a pending mint
      await act(async () => {
        await result.current.startMint(100);
      });

      let status;
      await act(async () => {
        status = await result.current.checkAndCompleteMint('quote123');
      });

      expect(status.completed).toBe(true);
      expect(status.proofs.length).toBe(2);
      expect(status.amount).toBe(100);
      expect(completeMint).toHaveBeenCalledWith('quote123', 100);
      expect(fetchBalance).toHaveBeenCalled();
      expect(result.current.pendingMints.length).toBe(0);
    });

    it('should throw error when quote not found', async () => {
      checkMintStatus.mockResolvedValue({ paid: true });

      const { result } = renderHook(() =>
        useCashuMint({ fetchBalance, setIsLoading, setError })
      );

      await expect(
        act(async () => {
          await result.current.checkAndCompleteMint('unknown');
        })
      ).rejects.toThrow('Quote not found');
    });

    it('should handle check error', async () => {
      checkMintStatus.mockRejectedValue(new Error('Check failed'));

      const { result } = renderHook(() =>
        useCashuMint({ fetchBalance, setIsLoading, setError })
      );

      await expect(
        act(async () => {
          await result.current.checkAndCompleteMint('quote123');
        })
      ).rejects.toThrow('Check failed');
    });
  });

  describe('removePendingMint', () => {
    it('should remove mint from pending list', async () => {
      const { result } = renderHook(() =>
        useCashuMint({ fetchBalance, setIsLoading, setError })
      );

      await act(async () => {
        await result.current.startMint(100);
      });

      expect(result.current.pendingMints.length).toBe(1);

      act(() => {
        result.current.removePendingMint('quote123');
      });

      expect(result.current.pendingMints.length).toBe(0);
    });
  });

  describe('autoMint', () => {
    it('should request mint and call onSuccess callback', async () => {
      const onSuccess = jest.fn();

      const { result } = renderHook(() =>
        useCashuMint({ fetchBalance, setIsLoading, setError })
      );

      let quote;
      await act(async () => {
        quote = await result.current.autoMint(100, onSuccess);
      });

      expect(requestMint).toHaveBeenCalledWith(100);
      expect(quote.quoteId).toBe('quote123');
      expect(onSuccess).toHaveBeenCalledWith({
        address: 'tb1p...',
        amount: 100,
        quoteId: 'quote123',
      });
      expect(result.current.pendingMints.length).toBe(1);
    });

    it('should handle autoMint error and show alert', async () => {
      requestMint.mockRejectedValue(new Error('Auto mint failed'));

      const { result } = renderHook(() =>
        useCashuMint({ fetchBalance, setIsLoading, setError })
      );

      await expect(
        act(async () => {
          await result.current.autoMint(100);
        })
      ).rejects.toThrow('Auto mint failed');

      expect(setError).toHaveBeenCalledWith('Auto mint failed');
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Auto mint failed');
    });
  });

  describe('polling', () => {
    it('should setup polling with usePolling', () => {
      renderHook(() =>
        useCashuMint({ fetchBalance, setIsLoading, setError })
      );

      expect(usePolling).toHaveBeenCalledWith(
        expect.objectContaining({
          interval: 5000,
          enabled: false,
          immediate: false,
        })
      );
    });

    it('should auto-complete pending mints when polling (lines 135-142)', async () => {
      // Capture the onPoll callback
      let capturedOnPoll;
      usePolling.mockImplementation(({ onPoll }) => {
        capturedOnPoll = onPoll;
      });

      checkMintStatus.mockResolvedValue({ paid: true, state: 'PAID' });

      const { result } = renderHook(() =>
        useCashuMint({ fetchBalance, setIsLoading, setError })
      );

      // First add a pending mint
      await act(async () => {
        await result.current.startMint(100);
      });

      expect(result.current.pendingMints.length).toBe(1);

      // Execute the polling callback
      await act(async () => {
        await capturedOnPoll();
      });

      // Mint should be auto-completed and removed from pending
      expect(checkMintStatus).toHaveBeenCalledWith('quote123');
      expect(completeMint).toHaveBeenCalledWith('quote123', 100);
      expect(result.current.pendingMints.length).toBe(0);
    });

    it('should handle polling errors gracefully (line 142)', async () => {
      const { logger } = require('../../utils/logger');

      // Capture the onPoll callback
      let capturedOnPoll;
      usePolling.mockImplementation(({ onPoll }) => {
        capturedOnPoll = onPoll;
      });

      checkMintStatus.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useCashuMint({ fetchBalance, setIsLoading, setError })
      );

      // First add a pending mint
      await act(async () => {
        await result.current.startMint(100);
      });

      // Execute the polling callback - should not throw
      await act(async () => {
        await capturedOnPoll();
      });

      // Error should be logged but not thrown
      expect(logger.debug).toHaveBeenCalledWith(
        'Error auto-completing mint',
        expect.objectContaining({ quoteId: 'quote123', error: 'Network error' })
      );
      // Mint should still be in pending list
      expect(result.current.pendingMints.length).toBe(1);
    });

    it('should enable polling when pendingMints has items', async () => {
      const { result } = renderHook(() =>
        useCashuMint({ fetchBalance, setIsLoading, setError })
      );

      // Initially polling is disabled
      expect(usePolling).toHaveBeenLastCalledWith(
        expect.objectContaining({
          enabled: false,
        })
      );

      // Add a pending mint
      await act(async () => {
        await result.current.startMint(100);
      });

      // Now polling should be enabled
      expect(usePolling).toHaveBeenLastCalledWith(
        expect.objectContaining({
          enabled: true,
        })
      );
    });
  });
});
