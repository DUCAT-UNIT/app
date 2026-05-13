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

jest.mock('../../services/cashu/cashuLockedTokensService', () => ({
  saveReceivedToken: jest.fn(),
  deleteReceivedTokenByToken: jest.fn(),
}));

import { receiveToken, sendToken } from '../../services/cashu/cashuWalletService';
import { saveReceivedToken } from '../../services/cashu/cashuLockedTokensService';

// Helper to render hooks
function renderHook<T>(hook: () => T, _options = {}): { result: { current: T | null }; unmount: () => void; component: ReturnType<typeof create> } {
  const result: { current: T | null } = { current: null };
  function TestComponent() {
    result.current = hook();
    return null;
  }
  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(<TestComponent />);
  });
  return { result, unmount: component!.unmount, component: component! };
}

describe('useCashuSendReceive', () => {
  let setIsLoading: jest.Mock;
  let setError: jest.Mock;
  let setBalance: jest.Mock;
  let fetchBalance: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    setIsLoading = jest.fn();
    setError = jest.fn();
    setBalance = jest.fn();
    fetchBalance = jest.fn().mockResolvedValue(100);
    (receiveToken as jest.Mock).mockResolvedValue({ amount: 100 });
    (sendToken as jest.Mock).mockResolvedValue({ token: 'cashuA...', amount: 50, balance: 450 });
    (saveReceivedToken as jest.Mock).mockResolvedValue(undefined);
  });

  it('should return receive and send functions', () => {
    const { result } = renderHook(() =>
      useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance })
    );

    expect(typeof result.current!.receive).toBe('function');
    expect(typeof result.current!.send).toBe('function');
  });

  describe('receive', () => {
    it('should receive token and refresh balance', async () => {
      const { result } = renderHook(() =>
        useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance })
      );

      let receiveResult: { amount: number } | undefined;
      await act(async () => {
        receiveResult = await result.current!.receive('cashuA...');
      });

      expect(setIsLoading).toHaveBeenCalledWith(true);
      expect(setError).toHaveBeenCalledWith(null);
      expect(receiveToken).toHaveBeenCalledWith('cashuA...', 'unit');
      expect(fetchBalance).toHaveBeenCalled();
      expect(receiveResult).toEqual({ amount: 100 });
      expect(setIsLoading).toHaveBeenLastCalledWith(false);
    });

    it('should handle receive error', async () => {
      (receiveToken as jest.Mock).mockRejectedValue(new Error('Token invalid'));

      const { result } = renderHook(() =>
        useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance })
      );

      await expect(
        act(async () => {
          await result.current!.receive('cashuA...');
        })
      ).rejects.toThrow('Token invalid');

      expect(setError).toHaveBeenCalledWith('Token invalid');
      expect(setIsLoading).toHaveBeenLastCalledWith(false);
    });

    it('should throw error on receive failure', async () => {
      (receiveToken as jest.Mock).mockRejectedValue(new Error('Already spent'));

      const { result } = renderHook(() =>
        useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance })
      );

      await act(async () => {
        try {
          await result.current!.receive('cashuA...');
        } catch (e) {
          expect((e as Error).message).toBe('Already spent');
        }
      });
    });

    it('should handle non-Error rejection in receive', async () => {
      (receiveToken as jest.Mock).mockRejectedValue('string error');

      const { result } = renderHook(() =>
        useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance })
      );

      await act(async () => {
        try {
          await result.current!.receive('cashuA...');
        } catch {
          // Expected to throw
        }
      });

      expect(setError).toHaveBeenCalledWith('string error');
    });

    it('should continue even if saveReceivedToken fails', async () => {
      (saveReceivedToken as jest.Mock).mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() =>
        useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance, taprootAddress: 'tb1ptest' })
      );

      let receiveResult: { amount: number } | undefined;
      await act(async () => {
        receiveResult = await result.current!.receive('cashuA...');
      });

      // Should still succeed even with save failure
      expect(receiveResult).toEqual({ amount: 100 });
      expect(fetchBalance).toHaveBeenCalled();
    });

    it('should handle non-Error saveReceivedToken failure', async () => {
      (saveReceivedToken as jest.Mock).mockRejectedValue('save error string');

      const { result } = renderHook(() =>
        useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance, taprootAddress: 'tb1ptest' })
      );

      let receiveResult: { amount: number } | undefined;
      await act(async () => {
        receiveResult = await result.current!.receive('cashuA...');
      });

      // Should still succeed even with save failure
      expect(receiveResult).toEqual({ amount: 100 });
    });

    it('should pass taprootAddress to saveReceivedToken', async () => {
      const { result } = renderHook(() =>
        useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance, taprootAddress: 'tb1ptestaddress' })
      );

      await act(async () => {
        await result.current!.receive('cashuA...');
      });

      expect(saveReceivedToken).toHaveBeenCalledWith(
        'cashuA...',
        'Cashu Receive',
        100,
        'tb1ptestaddress',
        'unit'
      );
    });

    it('should use empty string when taprootAddress is undefined', async () => {
      const { result } = renderHook(() =>
        useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance })
      );

      await act(async () => {
        await result.current!.receive('cashuA...');
      });

      expect(saveReceivedToken).toHaveBeenCalledWith('cashuA...', 'Cashu Receive', 100, '', 'unit');
    });

    it('should scope BTC Cashu receives and history to sat', async () => {
      const { result } = renderHook(() =>
        useCashuSendReceive({
          setIsLoading,
          setError,
          setBalance,
          fetchBalance,
          taprootAddress: 'tb1pbtc',
          unit: 'sat',
        })
      );

      await act(async () => {
        await result.current!.receive('cashuBbtc...');
      });

      expect(receiveToken).toHaveBeenCalledWith('cashuBbtc...', 'sat');
      expect(saveReceivedToken).toHaveBeenCalledWith('cashuBbtc...', 'Cashu Receive', 100, 'tb1pbtc', 'sat');
    });
  });

  describe('send', () => {
    it('should send token and update balance', async () => {
      const { result } = renderHook(() =>
        useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance })
      );

      let sendResult: { token: string; amount: number; balance: number } | undefined;
      await act(async () => {
        sendResult = await result.current!.send(50);
      });

      expect(setIsLoading).toHaveBeenCalledWith(true);
      expect(setError).toHaveBeenCalledWith(null);
      expect(sendToken).toHaveBeenCalledWith(50, true);
      expect(setBalance).toHaveBeenCalledWith(450);
      expect(sendResult).toEqual({ token: 'cashuA...', amount: 50, balance: 450 });
      expect(setIsLoading).toHaveBeenLastCalledWith(false);
    });

    it('should handle send error', async () => {
      (sendToken as jest.Mock).mockRejectedValue(new Error('Insufficient balance'));

      const { result } = renderHook(() =>
        useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance })
      );

      await expect(
        act(async () => {
          await result.current!.send(1000);
        })
      ).rejects.toThrow('Insufficient balance');

      expect(setError).toHaveBeenCalledWith('Insufficient balance');
      expect(setIsLoading).toHaveBeenLastCalledWith(false);
    });

    it('should throw error on send failure', async () => {
      (sendToken as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance })
      );

      await act(async () => {
        try {
          await result.current!.send(50);
        } catch (e) {
          expect((e as Error).message).toBe('Network error');
        }
      });
    });

    it('should handle non-Error rejection in send', async () => {
      (sendToken as jest.Mock).mockRejectedValue('string error');

      const { result } = renderHook(() =>
        useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance })
      );

      await act(async () => {
        try {
          await result.current!.send(50);
        } catch {
          // Expected to throw
        }
      });

      expect(setError).toHaveBeenCalledWith('string error');
    });
  });
});
