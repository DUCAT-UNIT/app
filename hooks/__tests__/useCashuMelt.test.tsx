// @ts-nocheck
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

describe('useCashuMelt', () => {
  let setIsLoading;
  let setError;
  let setBalance;

  beforeEach(() => {
    jest.clearAllMocks();
    setIsLoading = jest.fn();
    setError = jest.fn();
    setBalance = jest.fn();
    requestMelt.mockResolvedValue({ quoteId: 'quote123', total: 100 });
    completeMelt.mockResolvedValue({ txid: 'txid123', balance: 50 });
  });

  it('should return startMelt and finishMelt functions', () => {
    const { result } = renderHook(() =>
      useCashuMelt({ setIsLoading, setError, setBalance })
    );

    expect(typeof result.current.startMelt).toBe('function');
    expect(typeof result.current.finishMelt).toBe('function');
  });

  describe('startMelt', () => {
    it('should request melt and return quote', async () => {
      const { result } = renderHook(() =>
        useCashuMelt({ setIsLoading, setError, setBalance })
      );

      let quote;
      await act(async () => {
        quote = await result.current.startMelt('tb1p...', 100);
      });

      expect(setIsLoading).toHaveBeenCalledWith(true);
      expect(setError).toHaveBeenCalledWith(null);
      expect(requestMelt).toHaveBeenCalledWith('tb1p...', 100);
      expect(quote).toEqual({ quoteId: 'quote123', total: 100 });
      expect(setIsLoading).toHaveBeenLastCalledWith(false);
    });

    it('should handle melt request error', async () => {
      requestMelt.mockRejectedValue(new Error('Request failed'));

      const { result } = renderHook(() =>
        useCashuMelt({ setIsLoading, setError, setBalance })
      );

      await act(async () => {
        try {
          await result.current.startMelt('tb1p...', 100);
        } catch (e) {
          expect(e.message).toBe('Request failed');
        }
      });

      expect(setError).toHaveBeenCalledWith('Request failed');
      expect(setIsLoading).toHaveBeenLastCalledWith(false);
    });

    it('should throw error on melt request failure', async () => {
      requestMelt.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useCashuMelt({ setIsLoading, setError, setBalance })
      );

      await expect(
        act(async () => {
          await result.current.startMelt('tb1p...', 100);
        })
      ).rejects.toThrow('Network error');
    });
  });

  describe('finishMelt', () => {
    it('should complete melt and update balance', async () => {
      const { result } = renderHook(() =>
        useCashuMelt({ setIsLoading, setError, setBalance })
      );

      let meltResult;
      await act(async () => {
        meltResult = await result.current.finishMelt('quote123', 100);
      });

      expect(setIsLoading).toHaveBeenCalledWith(true);
      expect(setError).toHaveBeenCalledWith(null);
      expect(completeMelt).toHaveBeenCalledWith('quote123', 100);
      expect(setBalance).toHaveBeenCalledWith(50);
      expect(meltResult).toEqual({ txid: 'txid123', balance: 50 });
      expect(setIsLoading).toHaveBeenLastCalledWith(false);
    });

    it('should handle melt completion error', async () => {
      completeMelt.mockRejectedValue(new Error('Completion failed'));

      const { result } = renderHook(() =>
        useCashuMelt({ setIsLoading, setError, setBalance })
      );

      await act(async () => {
        try {
          await result.current.finishMelt('quote123', 100);
        } catch (e) {
          expect(e.message).toBe('Completion failed');
        }
      });

      expect(setError).toHaveBeenCalledWith('Completion failed');
      expect(setIsLoading).toHaveBeenLastCalledWith(false);
    });

    it('should throw error on melt completion failure', async () => {
      completeMelt.mockRejectedValue(new Error('Transaction failed'));

      const { result } = renderHook(() =>
        useCashuMelt({ setIsLoading, setError, setBalance })
      );

      await expect(
        act(async () => {
          await result.current.finishMelt('quote123', 100);
        })
      ).rejects.toThrow('Transaction failed');
    });
  });
});
