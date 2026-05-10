/**
 * useSendValidation Hook
 * Handles validation logic for send flow
 */

import { useMemo } from 'react';

export interface UseSendValidationOptions {
  /** Whether address is valid */
  isValidAddress: boolean;
  /** Current address error */
  addressError: string;
  /** Current recipient address */
  sendRecipient: string;
  /** Current send amount */
  currentAmount: number;
  /** Whether sending BTC (vs UNIT) */
  isBtc: boolean;
  /** Max sendable BTC amount */
  maxSendableBtc: number;
  /** Max sendable UNIT amount */
  maxSendableUnit: number;
  /** Whether there's sufficient BTC for UNIT fees */
  hasSufficientBtcForUnitFees: boolean;
  /** Whether a turbo mint is in progress */
  isRequestingMint: boolean;
}

export interface UseSendValidationResult {
  /** Whether address is valid */
  hasValidAddress: boolean;
  /** Whether amount is valid (> 0) */
  hasValidAmount: boolean;
  /** Whether amount exceeds available balance */
  exceedsBalance: boolean;
  /** Whether there's insufficient BTC for UNIT fees */
  insufficientBtcForFees: boolean;
  /** Whether the user can continue to review */
  canContinue: boolean;
}

export function useSendValidation({
  isValidAddress,
  addressError,
  sendRecipient,
  currentAmount,
  isBtc,
  maxSendableBtc,
  maxSendableUnit,
  hasSufficientBtcForUnitFees,
  isRequestingMint,
}: UseSendValidationOptions): UseSendValidationResult {
  const hasValidAddress = isValidAddress && !addressError && sendRecipient.length > 0;
  const hasValidAmount = isBtc
    ? currentAmount > 0
    : Math.round(currentAmount * 100) >= 1;

  const exceedsBalance = useMemo(() => {
    return isBtc
      ? currentAmount > maxSendableBtc
      : currentAmount > maxSendableUnit;
  }, [isBtc, currentAmount, maxSendableBtc, maxSendableUnit]);

  const insufficientBtcForFees = !isBtc && !hasSufficientBtcForUnitFees;

  const canContinue = useMemo(() => {
    return hasValidAddress &&
           hasValidAmount &&
           !exceedsBalance &&
           !insufficientBtcForFees &&
           !isRequestingMint;
  }, [hasValidAddress, hasValidAmount, exceedsBalance, insufficientBtcForFees, isRequestingMint]);

  return {
    hasValidAddress,
    hasValidAmount,
    exceedsBalance,
    insufficientBtcForFees,
    canContinue,
  };
}
