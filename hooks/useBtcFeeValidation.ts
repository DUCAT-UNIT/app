/**
 * useBtcFeeValidation Hook
 * Validates whether user has sufficient BTC for transaction fees
 * Used by vault action screens and transfer screens
 */

import { useState, useEffect, useMemo } from 'react';
import {
  TransactionType,
  BtcSufficiencyResult,
  hasSufficientBtcForFeesSync,
  hasSufficientBtcForFees,
} from '../services/feeEstimationService';

interface UseBtcFeeValidationParams {
  /** Transaction type to validate fees for */
  type: TransactionType;
  /** User's BTC balance in satoshis */
  btcBalanceSats: number;
  /** Source address for UTXO-based estimation (optional) */
  sourceAddress?: string;
  /** Whether to enable the validation (default: true) */
  enabled?: boolean;
}

interface UseBtcFeeValidationReturn {
  /** Whether user has sufficient BTC for fees */
  hasSufficientBtc: boolean;
  /** Required BTC amount in satoshis (with safety buffer) */
  requiredBtcSats: number;
  /** User's available BTC in satoshis */
  availableBtcSats: number;
  /** Shortfall amount in satoshis (0 if sufficient) */
  shortfallSats: number;
  /** Error message to display if insufficient */
  errorMessage: string | null;
  /** Whether validation is in progress */
  isValidating: boolean;
}

/**
 * Hook for validating BTC fee sufficiency
 * Returns synchronous result immediately, then updates with accurate async result
 * @param params - Hook parameters
 * @returns Validation state
 */
export function useBtcFeeValidation({
  type,
  btcBalanceSats,
  sourceAddress,
  enabled = true,
}: UseBtcFeeValidationParams): UseBtcFeeValidationReturn {
  // Immediate synchronous check for instant UI feedback
  const syncResult = useMemo(
    () => hasSufficientBtcForFeesSync(type, btcBalanceSats),
    [type, btcBalanceSats]
  );

  const [asyncResult, setAsyncResult] = useState<BtcSufficiencyResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Perform async validation with UTXO lookup when source address is available
  useEffect(() => {
    if (!enabled) return;

    // Skip async validation if no source address
    if (!sourceAddress) {
      setAsyncResult(null);
      return;
    }

    let cancelled = false;
    setIsValidating(true);

    hasSufficientBtcForFees(type, btcBalanceSats, sourceAddress)
      .then((result) => {
        if (!cancelled) {
          setAsyncResult(result);
        }
      })
      .catch(() => {
        // Keep using sync result on error
        if (!cancelled) {
          setAsyncResult(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsValidating(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [type, btcBalanceSats, sourceAddress, enabled]);

  // Use async result if available, otherwise fall back to sync result
  const result = asyncResult ?? syncResult;

  return {
    hasSufficientBtc: result.hasSufficientBtc,
    requiredBtcSats: result.requiredBtcSats,
    availableBtcSats: result.availableBtcSats,
    shortfallSats: result.shortfallSats,
    errorMessage: result.errorMessage,
    isValidating,
  };
}
