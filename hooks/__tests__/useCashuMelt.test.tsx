/**
 * Tests for useCashuMelt hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useCashuMelt } from '../useCashuMelt';

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
  requestMelt: jest.fn(),
  completeMelt: jest.fn(),
}));

import { requestMelt, completeMelt } from '../../services/cashu/cashuWalletService';

// Helper to render hooks
function renderHook<T>(hook: () => T): { result: { current: T | null }; unmount: () => void; component: ReturnType<typeof create> } {
  const result: { current: T | null } = { current: null };
  function TestComponent(): null {
    result.current = hook();
    return null;
  }
  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(<TestComponent />);
  });
  return { result, unmount: component!.unmount, component: component! };
}

describe('useCashuMelt', () => {
  let setIsLoading: jest.Mock;
  let setError: jest.Mock;
  let setBalance: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    setIsLoading = jest.fn();
    setError = jest.fn();
    setBalance = jest.fn();
    (requestMelt as jest.Mock).mockResolvedValue({ quoteId: 'quote123', total: 100 });
    (completeMelt as jest.Mock).mockResolvedValue({ txid: 'txid123', balance: 50 });
  });

  it('should return startMelt and finishMelt functions', () => {
    const { result } = renderHook(() =>
      useCashuMelt({ setIsLoading, setError, setBalance })
    );

    expect(typeof result.current!.startMelt).toBe('function');
    expect(typeof result.current!.finishMelt).toBe('function');
  });

  describe('startMelt', () => {
    it('should request melt and return quote', async () => {
      const { result } = renderHook(() =>
        useCashuMelt({ setIsLoading, setError, setBalance })
      );

      let quote;
      await act(async () => {
        quote = await result.current!.startMelt('tb1p...', 100);
      });

      expect(setIsLoading).toHaveBeenCalledWith(true);
      expect(setError).toHaveBeenCalledWith(null);
      expect(requestMelt).toHaveBeenCalledWith('tb1p...', 100);
      expect(quote).toEqual({ quoteId: 'quote123', total: 100 });
      expect(setIsLoading).toHaveBeenLastCalledWith(false);
    });

    it('should handle melt request error', async () => {
      (requestMelt as jest.Mock).mockRejectedValue(new Error('Request failed'));

      const { result } = renderHook(() =>
        useCashuMelt({ setIsLoading, setError, setBalance })
      );

      await act(async () => {
        try {
          await result.current!.startMelt('tb1p...', 100);
        } catch (e) {
          expect((e as Error).message).toBe('Request failed');
        }
      });

      expect(setError).toHaveBeenCalledWith('Request failed');
      expect(setIsLoading).toHaveBeenLastCalledWith(false);
    });

    it('should throw error on melt request failure', async () => {
      (requestMelt as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useCashuMelt({ setIsLoading, setError, setBalance })
      );

      await expect(
        act(async () => {
          await result.current!.startMelt('tb1p...', 100);
        })
      ).rejects.toThrow('Network error');
    });

    it('should handle non-Error rejection in startMelt', async () => {
      (requestMelt as jest.Mock).mockRejectedValue('string error');

      const { result } = renderHook(() =>
        useCashuMelt({ setIsLoading, setError, setBalance })
      );

      await act(async () => {
        try {
          await result.current!.startMelt('tb1p...', 100);
        } catch {
          // Expected to throw
        }
      });

      expect(setError).toHaveBeenCalledWith('string error');
    });
  });

  describe('finishMelt', () => {
    it('should complete melt and update balance', async () => {
      const { result } = renderHook(() =>
        useCashuMelt({ setIsLoading, setError, setBalance })
      );

      let meltResult;
      await act(async () => {
        meltResult = await result.current!.finishMelt('quote123', 100);
      });

      expect(setIsLoading).toHaveBeenCalledWith(true);
      expect(setError).toHaveBeenCalledWith(null);
      expect(completeMelt).toHaveBeenCalledWith('quote123', 100);
      expect(setBalance).toHaveBeenCalledWith(50);
      expect(meltResult).toEqual({ txid: 'txid123', balance: 50 });
      expect(setIsLoading).toHaveBeenLastCalledWith(false);
    });

    it('should handle melt completion error', async () => {
      (completeMelt as jest.Mock).mockRejectedValue(new Error('Completion failed'));

      const { result } = renderHook(() =>
        useCashuMelt({ setIsLoading, setError, setBalance })
      );

      await act(async () => {
        try {
          await result.current!.finishMelt('quote123', 100);
        } catch (e) {
          expect((e as Error).message).toBe('Completion failed');
        }
      });

      expect(setError).toHaveBeenCalledWith('Completion failed');
      expect(setIsLoading).toHaveBeenLastCalledWith(false);
    });

    it('should throw error on melt completion failure', async () => {
      (completeMelt as jest.Mock).mockRejectedValue(new Error('Transaction failed'));

      const { result } = renderHook(() =>
        useCashuMelt({ setIsLoading, setError, setBalance })
      );

      await expect(
        act(async () => {
          await result.current!.finishMelt('quote123', 100);
        })
      ).rejects.toThrow('Transaction failed');
    });

    it('should handle non-Error rejection in finishMelt', async () => {
      (completeMelt as jest.Mock).mockRejectedValue('string error');

      const { result } = renderHook(() =>
        useCashuMelt({ setIsLoading, setError, setBalance })
      );

      await act(async () => {
        try {
          await result.current!.finishMelt('quote123', 100);
        } catch {
          // Expected to throw
        }
      });

      expect(setError).toHaveBeenCalledWith('string error');
    });
  });
});
