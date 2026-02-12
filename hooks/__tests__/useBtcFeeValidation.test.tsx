/**
 * Tests for useBtcFeeValidation hook
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useBtcFeeValidation } from '../useBtcFeeValidation';
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
  hasSufficientBtcForFeesSync: jest.fn(),
  hasSufficientBtcForFees: jest.fn(),
}));

import {
  hasSufficientBtcForFeesSync,
  hasSufficientBtcForFees,
} from '../../services/feeEstimationService';

describe('useBtcFeeValidation', () => {
  const mockSyncResult = {
    hasSufficientBtc: true,
    requiredBtcSats: 300,
    availableBtcSats: 1000,
    shortfallSats: 0,
    errorMessage: null,
  };

  const mockAsyncResult = {
    hasSufficientBtc: true,
    requiredBtcSats: 280,
    availableBtcSats: 1000,
    shortfallSats: 0,
    errorMessage: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (hasSufficientBtcForFeesSync as jest.Mock).mockReturnValue(mockSyncResult);
    (hasSufficientBtcForFees as jest.Mock).mockResolvedValue(mockAsyncResult);
  });

  it('should return sync result immediately', () => {
    const { result } = renderHook(() =>
      useBtcFeeValidation({
        type: TransactionType.BTC_SEND,
        btcBalanceSats: 1000,
      })
    );

    expect(result.current!.hasSufficientBtc).toBe(true);
    expect(result.current!.requiredBtcSats).toBe(300);
    expect(result.current!.availableBtcSats).toBe(1000);
    expect(result.current!.shortfallSats).toBe(0);
    expect(result.current!.errorMessage).toBeNull();
  });

  it('should call hasSufficientBtcForFeesSync with correct params', () => {
    renderHook(() =>
      useBtcFeeValidation({
        type: TransactionType.VAULT_BORROW,
        btcBalanceSats: 5000,
      })
    );

    expect(hasSufficientBtcForFeesSync).toHaveBeenCalledWith(
      TransactionType.VAULT_BORROW,
      5000
    );
  });

  it('should perform async validation when sourceAddress is provided', async () => {
    const { result } = renderHook(() =>
      useBtcFeeValidation({
        type: TransactionType.BTC_SEND,
        btcBalanceSats: 1000,
        sourceAddress: 'tb1qtest123',
      })
    );

    // Initially validating
    expect(result.current!.isValidating).toBe(true);

    await waitFor(() => {
      expect(result.current!.isValidating).toBe(false);
    });

    expect(hasSufficientBtcForFees).toHaveBeenCalledWith(
      TransactionType.BTC_SEND,
      1000,
      'tb1qtest123'
    );

    // Should use async result
    expect(result.current!.requiredBtcSats).toBe(280);
  });

  it('should not perform async validation without sourceAddress', async () => {
    const { result } = renderHook(() =>
      useBtcFeeValidation({
        type: TransactionType.BTC_SEND,
        btcBalanceSats: 1000,
      })
    );

    expect(result.current!.isValidating).toBe(false);
    expect(hasSufficientBtcForFees).not.toHaveBeenCalled();
  });

  it('should handle insufficient balance', () => {
    const insufficientResult = {
      hasSufficientBtc: false,
      requiredBtcSats: 500,
      availableBtcSats: 100,
      shortfallSats: 400,
      errorMessage: 'Need more BTC for fees',
    };
    (hasSufficientBtcForFeesSync as jest.Mock).mockReturnValue(insufficientResult);

    const { result } = renderHook(() =>
      useBtcFeeValidation({
        type: TransactionType.UNIT_SEND,
        btcBalanceSats: 100,
      })
    );

    expect(result.current!.hasSufficientBtc).toBe(false);
    expect(result.current!.shortfallSats).toBe(400);
    expect(result.current!.errorMessage).toBe('Need more BTC for fees');
  });

  it('should skip validation when disabled', () => {
    const { result } = renderHook(() =>
      useBtcFeeValidation({
        type: TransactionType.BTC_SEND,
        btcBalanceSats: 1000,
        sourceAddress: 'tb1qtest123',
        enabled: false,
      })
    );

    expect(result.current!.isValidating).toBe(false);
    expect(hasSufficientBtcForFees).not.toHaveBeenCalled();
  });

  it('should fall back to sync result on async error', async () => {
    (hasSufficientBtcForFees as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useBtcFeeValidation({
        type: TransactionType.BTC_SEND,
        btcBalanceSats: 1000,
        sourceAddress: 'tb1qtest123',
      })
    );

    await waitFor(() => {
      expect(result.current!.isValidating).toBe(false);
    });

    // Should still use sync result
    expect(result.current!.requiredBtcSats).toBe(300);
  });

  it('should update when btcBalanceSats changes', () => {
    const { result, rerender } = renderHook(
      ({ balance }) =>
        useBtcFeeValidation({
          type: TransactionType.BTC_SEND,
          btcBalanceSats: balance,
        }),
      { initialProps: { balance: 1000 } }
    );

    expect(hasSufficientBtcForFeesSync).toHaveBeenCalledWith(
      TransactionType.BTC_SEND,
      1000
    );

    rerender({ balance: 2000 });

    expect(hasSufficientBtcForFeesSync).toHaveBeenCalledWith(
      TransactionType.BTC_SEND,
      2000
    );
  });

  it('should update when transaction type changes', () => {
    const { result, rerender } = renderHook(
      ({ type }) =>
        useBtcFeeValidation({
          type,
          btcBalanceSats: 1000,
        }),
      { initialProps: { type: TransactionType.BTC_SEND } }
    );

    rerender({ type: TransactionType.VAULT_DEPOSIT });

    expect(hasSufficientBtcForFeesSync).toHaveBeenCalledWith(
      TransactionType.VAULT_DEPOSIT,
      1000
    );
  });

  it('should handle zero balance', () => {
    const zeroBalanceResult = {
      hasSufficientBtc: false,
      requiredBtcSats: 300,
      availableBtcSats: 0,
      shortfallSats: 300,
      errorMessage: 'You need BTC for fees',
    };
    (hasSufficientBtcForFeesSync as jest.Mock).mockReturnValue(zeroBalanceResult);

    const { result } = renderHook(() =>
      useBtcFeeValidation({
        type: TransactionType.BTC_SEND,
        btcBalanceSats: 0,
      })
    );

    expect(result.current!.hasSufficientBtc).toBe(false);
    expect(result.current!.availableBtcSats).toBe(0);
    expect(result.current!.shortfallSats).toBe(300);
  });

  it('should cancel async validation on unmount', async () => {
    let resolvePromise: (value: typeof mockAsyncResult) => void;
    const asyncPromise = new Promise<typeof mockAsyncResult>((resolve) => {
      resolvePromise = resolve;
    });
    (hasSufficientBtcForFees as jest.Mock).mockReturnValue(asyncPromise);

    const { result, unmount } = renderHook(() =>
      useBtcFeeValidation({
        type: TransactionType.BTC_SEND,
        btcBalanceSats: 1000,
        sourceAddress: 'tb1qtest123',
      })
    );

    expect(result.current!.isValidating).toBe(true);

    // Unmount before promise resolves
    unmount();

    // Resolve promise after unmount
    resolvePromise!(mockAsyncResult);

    // No error should occur from setting state on unmounted component
  });

  it('should handle all vault transaction types', () => {
    const vaultTypes = [
      TransactionType.VAULT_DEPOSIT,
      TransactionType.VAULT_WITHDRAW,
      TransactionType.VAULT_BORROW,
      TransactionType.VAULT_REPAY,
    ];

    for (const type of vaultTypes) {
      jest.clearAllMocks();

      renderHook(() =>
        useBtcFeeValidation({
          type,
          btcBalanceSats: 5000,
        })
      );

      expect(hasSufficientBtcForFeesSync).toHaveBeenCalledWith(type, 5000);
    }
  });
});
