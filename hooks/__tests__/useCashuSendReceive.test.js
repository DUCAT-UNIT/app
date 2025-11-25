/**
 * Tests for useCashuSendReceive hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useCashuSendReceive } from '../useCashuSendReceive';

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
  receiveToken: jest.fn(),
  sendToken: jest.fn(),
}));

import { receiveToken, sendToken } from '../../services/cashu/cashuWalletService';

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

describe('useCashuSendReceive', () => {
  let setIsLoading;
  let setError;
  let setBalance;
  let fetchBalance;

  beforeEach(() => {
    jest.clearAllMocks();
    setIsLoading = jest.fn();
    setError = jest.fn();
    setBalance = jest.fn();
    fetchBalance = jest.fn().mockResolvedValue();
    receiveToken.mockResolvedValue({ amount: 100 });
    sendToken.mockResolvedValue({ token: 'cashuA...', amount: 50, balance: 450 });
  });

  it('should return receive and send functions', () => {
    const { result } = renderHook(() =>
      useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance })
    );

    expect(typeof result.current.receive).toBe('function');
    expect(typeof result.current.send).toBe('function');
  });

  describe('receive', () => {
    it('should receive token and refresh balance', async () => {
      const { result } = renderHook(() =>
        useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance })
      );

      let receiveResult;
      await act(async () => {
        receiveResult = await result.current.receive('cashuA...');
      });

      expect(setIsLoading).toHaveBeenCalledWith(true);
      expect(setError).toHaveBeenCalledWith(null);
      expect(receiveToken).toHaveBeenCalledWith('cashuA...');
      expect(fetchBalance).toHaveBeenCalled();
      expect(receiveResult).toEqual({ amount: 100 });
      expect(setIsLoading).toHaveBeenLastCalledWith(false);
    });

    it('should handle receive error', async () => {
      receiveToken.mockRejectedValue(new Error('Token invalid'));

      const { result } = renderHook(() =>
        useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance })
      );

      await expect(
        act(async () => {
          await result.current.receive('cashuA...');
        })
      ).rejects.toThrow('Token invalid');

      expect(setError).toHaveBeenCalledWith('Token invalid');
      expect(setIsLoading).toHaveBeenLastCalledWith(false);
    });

    it('should throw error on receive failure', async () => {
      receiveToken.mockRejectedValue(new Error('Already spent'));

      const { result } = renderHook(() =>
        useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance })
      );

      await act(async () => {
        try {
          await result.current.receive('cashuA...');
        } catch (e) {
          expect(e.message).toBe('Already spent');
        }
      });
    });
  });

  describe('send', () => {
    it('should send token and update balance', async () => {
      const { result } = renderHook(() =>
        useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance })
      );

      let sendResult;
      await act(async () => {
        sendResult = await result.current.send(50);
      });

      expect(setIsLoading).toHaveBeenCalledWith(true);
      expect(setError).toHaveBeenCalledWith(null);
      expect(sendToken).toHaveBeenCalledWith(50, true);
      expect(setBalance).toHaveBeenCalledWith(450);
      expect(sendResult).toEqual({ token: 'cashuA...', amount: 50, balance: 450 });
      expect(setIsLoading).toHaveBeenLastCalledWith(false);
    });

    it('should handle send error', async () => {
      sendToken.mockRejectedValue(new Error('Insufficient balance'));

      const { result } = renderHook(() =>
        useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance })
      );

      await expect(
        act(async () => {
          await result.current.send(1000);
        })
      ).rejects.toThrow('Insufficient balance');

      expect(setError).toHaveBeenCalledWith('Insufficient balance');
      expect(setIsLoading).toHaveBeenLastCalledWith(false);
    });

    it('should throw error on send failure', async () => {
      sendToken.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance })
      );

      await act(async () => {
        try {
          await result.current.send(50);
        } catch (e) {
          expect(e.message).toBe('Network error');
        }
      });
    });
  });
});
