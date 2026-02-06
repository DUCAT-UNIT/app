/**
 * Tests for useSendValidation hook
 */

import { renderHook } from '@testing-library/react-native';
import { useSendValidation } from '../hooks/useSendValidation';

describe('useSendValidation', () => {
  const defaultOptions = {
    isValidAddress: true,
    addressError: '',
    sendRecipient: 'tb1qtest123',
    currentAmount: 0.001,
    isBtc: true,
    maxSendableBtc: 0.01,
    maxSendableUnit: 100,
    hasSufficientBtcForUnitFees: true,
    isRequestingMint: false,
  };

  it('should return canContinue true when all validations pass', () => {
    const { result } = renderHook(() => useSendValidation(defaultOptions));

    expect(result.current!.hasValidAddress).toBe(true);
    expect(result.current!.hasValidAmount).toBe(true);
    expect(result.current!.exceedsBalance).toBe(false);
    expect(result.current!.insufficientBtcForFees).toBe(false);
    expect(result.current!.canContinue).toBe(true);
  });

  it('should return canContinue false when address is invalid', () => {
    const { result } = renderHook(() =>
      useSendValidation({ ...defaultOptions, isValidAddress: false })
    );

    expect(result.current!.hasValidAddress).toBe(false);
    expect(result.current!.canContinue).toBe(false);
  });

  it('should return canContinue false when there is an address error', () => {
    const { result } = renderHook(() =>
      useSendValidation({ ...defaultOptions, addressError: 'Invalid address' })
    );

    expect(result.current!.hasValidAddress).toBe(false);
    expect(result.current!.canContinue).toBe(false);
  });

  it('should return canContinue false when recipient is empty', () => {
    const { result } = renderHook(() =>
      useSendValidation({ ...defaultOptions, sendRecipient: '' })
    );

    expect(result.current!.hasValidAddress).toBe(false);
    expect(result.current!.canContinue).toBe(false);
  });

  it('should return canContinue false when amount is zero', () => {
    const { result } = renderHook(() =>
      useSendValidation({ ...defaultOptions, currentAmount: 0 })
    );

    expect(result.current!.hasValidAmount).toBe(false);
    expect(result.current!.canContinue).toBe(false);
  });

  it('should return exceedsBalance true when BTC amount exceeds max', () => {
    const { result } = renderHook(() =>
      useSendValidation({
        ...defaultOptions,
        currentAmount: 0.02, // More than maxSendableBtc of 0.01
      })
    );

    expect(result.current!.exceedsBalance).toBe(true);
    expect(result.current!.canContinue).toBe(false);
  });

  it('should return exceedsBalance true when UNIT amount exceeds max', () => {
    const { result } = renderHook(() =>
      useSendValidation({
        ...defaultOptions,
        isBtc: false,
        currentAmount: 150, // More than maxSendableUnit of 100
      })
    );

    expect(result.current!.exceedsBalance).toBe(true);
    expect(result.current!.canContinue).toBe(false);
  });

  it('should return insufficientBtcForFees true for UNIT when no BTC for fees', () => {
    const { result } = renderHook(() =>
      useSendValidation({
        ...defaultOptions,
        isBtc: false,
        hasSufficientBtcForUnitFees: false,
      })
    );

    expect(result.current!.insufficientBtcForFees).toBe(true);
    expect(result.current!.canContinue).toBe(false);
  });

  it('should return canContinue false when turbo mint is in progress', () => {
    const { result } = renderHook(() =>
      useSendValidation({ ...defaultOptions, isRequestingMint: true })
    );

    expect(result.current!.canContinue).toBe(false);
  });

  it('should not show insufficientBtcForFees for BTC sends', () => {
    const { result } = renderHook(() =>
      useSendValidation({
        ...defaultOptions,
        isBtc: true,
        hasSufficientBtcForUnitFees: false, // This doesn't matter for BTC
      })
    );

    expect(result.current!.insufficientBtcForFees).toBe(false);
  });
});
