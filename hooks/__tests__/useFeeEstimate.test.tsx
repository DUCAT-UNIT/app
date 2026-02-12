/**
 * Tests for useFeeEstimate hook
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useFeeEstimate } from '../useFeeEstimate';
import { TransactionType } from '../../services/feeEstimationService';

// Mock the fee estimation service
jest.mock('../../services/feeEstimationService', () => ({
  TransactionType: {
    BTC_SEND: 'BTC_SEND',
    UNIT_SEND: 'UNIT_SEND',
    VAULT_DEPOSIT: 'VAULT_DEPOSIT',
    VAULT_WITHDRAW: 'VAULT_WITHDRAW',
    VAULT_BORROW: 'VAULT_BORROW',
    VAULT_REPAY: 'VAULT_REPAY',
  },
  estimateTransactionFeeQuick: jest.fn(),
  estimateTransactionFee: jest.fn(),
}));

import {
  estimateTransactionFeeQuick,
  estimateTransactionFee,
} from '../../services/feeEstimationService';

describe('useFeeEstimate', () => {
  const mockQuickEstimate = 250;
  const mockDetailedEstimate = {
    feeSats: 280,
    feeRate: 1,
    numInputs: 2,
    numOutputs: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (estimateTransactionFeeQuick as jest.Mock).mockReturnValue(mockQuickEstimate);
    (estimateTransactionFee as jest.Mock).mockResolvedValue(mockDetailedEstimate);
  });

  it('should return quick estimate immediately', () => {
    const { result } = renderHook(() =>
      useFeeEstimate({
        type: TransactionType.BTC_SEND,
      })
    );

    expect(result.current!.feeEstimateSats).toBe(mockQuickEstimate);
    expect(estimateTransactionFeeQuick).toHaveBeenCalledWith(
      TransactionType.BTC_SEND,
      undefined
    );
  });

  it('should fetch detailed estimate on mount', async () => {
    const { result } = renderHook(() =>
      useFeeEstimate({
        type: TransactionType.BTC_SEND,
      })
    );

    expect(result.current!.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current!.isLoading).toBe(false);
    });

    expect(result.current!.feeEstimateSats).toBe(280);
    expect(result.current!.feeEstimate).toEqual(mockDetailedEstimate);
    expect(estimateTransactionFee).toHaveBeenCalledWith(
      TransactionType.BTC_SEND,
      undefined,
      undefined
    );
  });

  it('should pass sourceAddress to estimateTransactionFee', async () => {
    const { result } = renderHook(() =>
      useFeeEstimate({
        type: TransactionType.BTC_SEND,
        sourceAddress: 'tb1qtest123',
      })
    );

    await waitFor(() => {
      expect(result.current!.isLoading).toBe(false);
    });

    expect(estimateTransactionFee).toHaveBeenCalledWith(
      TransactionType.BTC_SEND,
      'tb1qtest123',
      undefined
    );
  });

  it('should pass feeRate to both quick and detailed estimates', async () => {
    const { result } = renderHook(() =>
      useFeeEstimate({
        type: TransactionType.BTC_SEND,
        feeRate: 5,
      })
    );

    expect(estimateTransactionFeeQuick).toHaveBeenCalledWith(
      TransactionType.BTC_SEND,
      5
    );

    await waitFor(() => {
      expect(result.current!.isLoading).toBe(false);
    });

    expect(estimateTransactionFee).toHaveBeenCalledWith(
      TransactionType.BTC_SEND,
      undefined,
      5
    );
  });

  it('should not fetch when disabled', async () => {
    const { result } = renderHook(() =>
      useFeeEstimate({
        type: TransactionType.BTC_SEND,
        enabled: false,
      })
    );

    expect(result.current!.isLoading).toBe(false);
    expect(estimateTransactionFee).not.toHaveBeenCalled();
  });

  it('should set error on fetch failure', async () => {
    (estimateTransactionFee as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useFeeEstimate({
        type: TransactionType.BTC_SEND,
      })
    );

    await waitFor(() => {
      expect(result.current!.isLoading).toBe(false);
    });

    expect(result.current!.error).toBe('Failed to estimate fees');
    // Should fall back to quick estimate
    expect(result.current!.feeEstimateSats).toBe(mockQuickEstimate);
  });

  it('should provide refetch function', async () => {
    const { result } = renderHook(() =>
      useFeeEstimate({
        type: TransactionType.BTC_SEND,
      })
    );

    await waitFor(() => {
      expect(result.current!.isLoading).toBe(false);
    });

    expect(estimateTransactionFee).toHaveBeenCalledTimes(1);

    // Update mock for next call
    const newEstimate = { ...mockDetailedEstimate, feeSats: 300 };
    (estimateTransactionFee as jest.Mock).mockResolvedValue(newEstimate);

    await act(async () => {
      await result.current!.refetch();
    });

    expect(estimateTransactionFee).toHaveBeenCalledTimes(2);
    expect(result.current!.feeEstimateSats).toBe(300);
  });

  it('should refetch when type changes', async () => {
    const { result, rerender } = renderHook(
      ({ type }) =>
        useFeeEstimate({
          type,
        }),
      { initialProps: { type: TransactionType.BTC_SEND } }
    );

    await waitFor(() => {
      expect(result.current!.isLoading).toBe(false);
    });

    rerender({ type: TransactionType.VAULT_DEPOSIT });

    await waitFor(() => {
      expect(result.current!.isLoading).toBe(false);
    });

    expect(estimateTransactionFee).toHaveBeenCalledWith(
      TransactionType.VAULT_DEPOSIT,
      undefined,
      undefined
    );
  });

  it('should refetch when sourceAddress changes', async () => {
    const { result, rerender } = renderHook(
      ({ sourceAddress }) =>
        useFeeEstimate({
          type: TransactionType.BTC_SEND,
          sourceAddress,
        }),
      { initialProps: { sourceAddress: undefined as string | undefined } }
    );

    await waitFor(() => {
      expect(result.current!.isLoading).toBe(false);
    });

    rerender({ sourceAddress: 'tb1qnewaddress' });

    await waitFor(() => {
      expect(estimateTransactionFee).toHaveBeenCalledWith(
        TransactionType.BTC_SEND,
        'tb1qnewaddress',
        undefined
      );
    });
  });

  it('should refetch when feeRate changes', async () => {
    const { result, rerender } = renderHook(
      ({ feeRate }) =>
        useFeeEstimate({
          type: TransactionType.BTC_SEND,
          feeRate,
        }),
      { initialProps: { feeRate: 1 } }
    );

    await waitFor(() => {
      expect(result.current!.isLoading).toBe(false);
    });

    rerender({ feeRate: 10 });

    await waitFor(() => {
      expect(estimateTransactionFeeQuick).toHaveBeenCalledWith(
        TransactionType.BTC_SEND,
        10
      );
    });
  });

  it('should handle all transaction types', async () => {
    const types = [
      TransactionType.BTC_SEND,
      TransactionType.UNIT_SEND,
      TransactionType.VAULT_DEPOSIT,
      TransactionType.VAULT_WITHDRAW,
      TransactionType.VAULT_BORROW,
      TransactionType.VAULT_REPAY,
    ];

    for (const type of types) {
      jest.clearAllMocks();

      const { result } = renderHook(() =>
        useFeeEstimate({ type })
      );

      await waitFor(() => {
        expect(result.current!.isLoading).toBe(false);
      });

      expect(estimateTransactionFee).toHaveBeenCalledWith(
        type,
        undefined,
        undefined
      );
    }
  });

  it('should clear error on successful refetch', async () => {
    // First call fails
    (estimateTransactionFee as jest.Mock).mockRejectedValueOnce(new Error('Error'));

    const { result } = renderHook(() =>
      useFeeEstimate({
        type: TransactionType.BTC_SEND,
      })
    );

    await waitFor(() => {
      expect(result.current!.error).toBe('Failed to estimate fees');
    });

    // Second call succeeds
    (estimateTransactionFee as jest.Mock).mockResolvedValue(mockDetailedEstimate);

    await act(async () => {
      await result.current!.refetch();
    });

    expect(result.current!.error).toBeNull();
    expect(result.current!.feeEstimate).toEqual(mockDetailedEstimate);
  });

  it('should return feeEstimate as null initially', () => {
    // Don't let the async call resolve yet
    (estimateTransactionFee as jest.Mock).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() =>
      useFeeEstimate({
        type: TransactionType.BTC_SEND,
      })
    );

    expect(result.current!.feeEstimate).toBeNull();
    expect(result.current!.feeEstimateSats).toBe(mockQuickEstimate);
  });

  it('should not call refetch when disabled', async () => {
    const { result } = renderHook(() =>
      useFeeEstimate({
        type: TransactionType.BTC_SEND,
        enabled: false,
      })
    );

    await act(async () => {
      await result.current!.refetch();
    });

    expect(estimateTransactionFee).not.toHaveBeenCalled();
  });
});
