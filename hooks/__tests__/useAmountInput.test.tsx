/**
 * Tests for useAmountInput Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useAmountInput } from '../useAmountInput';
import * as transactionCalculationService from '../../services/transactionCalculationService';

type UseAmountInputParams = Parameters<typeof useAmountInput>[0];

// Helper to render hooks with react-test-renderer
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

  return {
    result,
    unmount: () => component?.unmount(),
  };
}

// Mock dependencies
jest.mock('../../services/transactionCalculationService');
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('useAmountInput', () => {
  const mockSetSendAmount = jest.fn();
  const mockWallet = {
    segwitAddress: 'bc1qsegwit',
    taprootAddress: 'bc1ptaproot',
    segwitPubkey: 'pubkey1',
    taprootPubkey: 'pubkey2',
  };

  const defaultProps: UseAmountInputParams = {
    sendAssetType: 'btc',
    segwitBalance: 50000000,
    taprootBalance: 30000000,
    runesBalance: [{ rune: 'UNIT', amount: '1000', divisibility: 0 }],
    cashuBalance: 0,
    wallet: mockWallet,
    sendAddressType: 'segwit',
    setSendAmount: mockSetSendAmount,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('balance calculation', () => {
    it('should use only segwit balance for BTC', () => {
      const { result } = renderHook(() => useAmountInput(defaultProps));

      // BTC is always sent from segwit, so only show segwit balance
      expect(result.current!.balance).toBe(50000000); // segwit only, not combined
      expect(result.current!.assetLabel).toBe('BTC');
    });

    it('should use UNIT balance when sendAssetType is unit', () => {
      const { result } = renderHook(() =>
        useAmountInput({ ...defaultProps, sendAssetType: 'unit' as const })
      );

      expect(result.current!.balance).toBe(1000);
      expect(result.current!.assetLabel).toBe('UNIT');
    });

    it('should handle null balances', () => {
      const { result } = renderHook(() =>
        useAmountInput({
          ...defaultProps,
          segwitBalance: null as unknown as number,
          taprootBalance: null as unknown as number,
        })
      );

      expect(result.current!.balance).toBe(0);
    });

    it('should handle undefined balances', () => {
      const { result } = renderHook(() =>
        useAmountInput({
          ...defaultProps,
          segwitBalance: undefined as unknown as number,
          taprootBalance: undefined,
        })
      );

      expect(result.current!.balance).toBe(0);
    });

    it('should handle empty runes balance', () => {
      const { result } = renderHook(() =>
        useAmountInput({
          ...defaultProps,
          sendAssetType: 'unit' as const,
          runesBalance: [],
        })
      );

      expect(result.current!.balance).toBe(0);
    });

    it('should handle null runes balance', () => {
      const { result } = renderHook(() =>
        useAmountInput({
          ...defaultProps,
          sendAssetType: 'unit' as const,
          runesBalance: null,
        })
      );

      expect(result.current!.balance).toBe(0);
    });
  });

  describe('handleMaxPress - BTC', () => {
    it('should calculate max BTC using segwit address and balance', async () => {
      (transactionCalculationService.calculateMaxSendableBTC as jest.Mock).mockResolvedValue(0.75);

      const { result } = renderHook(() => useAmountInput(defaultProps));

      await act(async () => {
        await result.current!.handleMaxPress();
      });

      // Should always use segwit address and segwit balance only for BTC
      expect(transactionCalculationService.calculateMaxSendableBTC).toHaveBeenCalledWith({
        sourceAddress: 'bc1qsegwit',
        btcBalance: 50000000, // segwit balance only, not combined
      });
      expect(mockSetSendAmount).toHaveBeenCalledWith('0.75');
    });

    it('should always use segwit address for BTC regardless of destination', async () => {
      (transactionCalculationService.calculateMaxSendableBTC as jest.Mock).mockResolvedValue(0.6);

      // Even when sending to taproot address, should use segwit as source
      const { result } = renderHook(() =>
        useAmountInput({ ...defaultProps, sendAddressType: 'taproot' })
      );

      await act(async () => {
        await result.current!.handleMaxPress();
      });

      // Should always use segwit address and segwit balance for BTC
      expect(transactionCalculationService.calculateMaxSendableBTC).toHaveBeenCalledWith({
        sourceAddress: 'bc1qsegwit',
        btcBalance: 50000000, // segwit balance only, not combined
      });
      expect(mockSetSendAmount).toHaveBeenCalledWith('0.6');
    });

    it('should set isCalculatingMax during calculation', async () => {
      let resolveCalculation: (value: number) => void;
      const calculationPromise = new Promise<number>((resolve) => {
        resolveCalculation = resolve;
      });
      (transactionCalculationService.calculateMaxSendableBTC as jest.Mock).mockReturnValue(calculationPromise);

      const { result } = renderHook(() => useAmountInput(defaultProps));

      expect(result.current!.isCalculatingMax).toBe(false);

      act(() => {
        result.current!.handleMaxPress();
      });

      expect(result.current!.isCalculatingMax).toBe(true);

      await act(async () => {
        resolveCalculation!(0.5);
        await calculationPromise;
      });

      expect(result.current!.isCalculatingMax).toBe(false);
    });

    it('should fallback to segwit balance on error', async () => {
      (transactionCalculationService.calculateMaxSendableBTC as jest.Mock).mockRejectedValue(
        new Error('Calculation failed')
      );

      const { result } = renderHook(() => useAmountInput(defaultProps));

      await act(async () => {
        await result.current!.handleMaxPress();
      });

      // Should fallback to segwit balance only, not combined
      expect(mockSetSendAmount).toHaveBeenCalledWith('50000000');
    });

    it('should handle null balance on error', async () => {
      (transactionCalculationService.calculateMaxSendableBTC as jest.Mock).mockRejectedValue(
        new Error('Calculation failed')
      );

      const { result } = renderHook(() =>
        useAmountInput({
          ...defaultProps,
          segwitBalance: null as unknown as number,
          taprootBalance: null as unknown as number,
        })
      );

      await act(async () => {
        await result.current!.handleMaxPress();
      });

      expect(mockSetSendAmount).toHaveBeenCalledWith('0');
    });
  });

  describe('handleMaxPress - UNIT', () => {
    it('should set full balance for UNIT', async () => {
      const { result } = renderHook(() =>
        useAmountInput({ ...defaultProps, sendAssetType: 'unit' as const })
      );

      await act(async () => {
        await result.current!.handleMaxPress();
      });

      expect(mockSetSendAmount).toHaveBeenCalledWith('1000');
      expect(transactionCalculationService.calculateMaxSendableBTC).not.toHaveBeenCalled();
    });

    it('should set 0 for UNIT when balance is null', async () => {
      const { result } = renderHook(() =>
        useAmountInput({
          ...defaultProps,
          sendAssetType: 'unit' as const,
          runesBalance: null,
        })
      );

      await act(async () => {
        await result.current!.handleMaxPress();
      });

      expect(mockSetSendAmount).toHaveBeenCalledWith('0');
    });
  });

  describe('calculateUsdValue', () => {
    it('should calculate USD value for BTC', () => {
      const { result } = renderHook(() => useAmountInput(defaultProps));

      const usdValue = result.current!.calculateUsdValue('1.5', 50000);

      expect(usdValue).toBe('75,000.00');
    });

    it('should calculate USD value for UNIT', () => {
      const { result } = renderHook(() =>
        useAmountInput({ ...defaultProps, sendAssetType: 'unit' as const })
      );

      const usdValue = result.current!.calculateUsdValue('100', 50000);

      expect(usdValue).toBe('100.00');
    });

    it('should return 0.00 for empty amount', () => {
      const { result } = renderHook(() => useAmountInput(defaultProps));

      const usdValue = result.current!.calculateUsdValue('', 50000);

      expect(usdValue).toBe('0.00');
    });

    it('should return 0.00 for null amount', () => {
      const { result } = renderHook(() => useAmountInput(defaultProps));

      const usdValue = result.current!.calculateUsdValue(null as unknown as string, 50000);

      expect(usdValue).toBe('0.00');
    });

    it('should return 0.00 when BTC price is 0', () => {
      const { result } = renderHook(() => useAmountInput(defaultProps));

      const usdValue = result.current!.calculateUsdValue('1.5', 0);

      expect(usdValue).toBe('0.00');
    });

    it('should format with 2 decimal places', () => {
      const { result } = renderHook(() => useAmountInput(defaultProps));

      const usdValue = result.current!.calculateUsdValue('0.12345', 50000);

      expect(usdValue).toMatch(/^\d{1,3}(,\d{3})*\.\d{2}$/);
    });

    it('should handle large values with thousand separators', () => {
      const { result } = renderHook(() => useAmountInput(defaultProps));

      const usdValue = result.current!.calculateUsdValue('100', 50000);

      expect(usdValue).toBe('5,000,000.00');
    });
  });

  describe('return values', () => {
    it('should return all expected properties', () => {
      const { result } = renderHook(() => useAmountInput(defaultProps));

      expect(result.current).toHaveProperty('balance');
      expect(result.current).toHaveProperty('assetLabel');
      expect(result.current).toHaveProperty('isCalculatingMax');
      expect(result.current).toHaveProperty('handleMaxPress');
      expect(result.current).toHaveProperty('calculateUsdValue');
    });

    it('should have handleMaxPress as a function', () => {
      const { result } = renderHook(() => useAmountInput(defaultProps));

      expect(typeof result.current!.handleMaxPress).toBe('function');
    });

    it('should have calculateUsdValue as a function', () => {
      const { result } = renderHook(() => useAmountInput(defaultProps));

      expect(typeof result.current!.calculateUsdValue).toBe('function');
    });
  });
});
