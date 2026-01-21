/**
 * useFeeEstimate Hook
 * Provides fee estimation for different transaction types with caching and auto-refresh
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TransactionType,
  FeeEstimate,
  estimateTransactionFee,
  estimateTransactionFeeQuick,
} from '../services/feeEstimationService';

interface UseFeeEstimateParams {
  /** Transaction type to estimate fees for */
  type: TransactionType;
  /** Source address for UTXO-based estimation (optional) */
  sourceAddress?: string;
  /** Whether to enable the hook (default: true) */
  enabled?: boolean;
  /** Fee rate in sat/vB (optional, uses default if not provided) */
  feeRate?: number;
}

interface UseFeeEstimateReturn {
  /** Estimated fee in satoshis */
  feeEstimateSats: number;
  /** Full fee estimate with details */
  feeEstimate: FeeEstimate | null;
  /** Whether fee estimation is in progress */
  isLoading: boolean;
  /** Error message if estimation failed */
  error: string | null;
  /** Manually refetch the fee estimate */
  refetch: () => Promise<void>;
}

/**
 * Hook for estimating transaction fees
 * Returns cached quick estimate immediately, then updates with accurate UTXO-based estimate
 * @param params - Hook parameters
 * @returns Fee estimate state and refetch function
 */
export function useFeeEstimate({
  type,
  sourceAddress,
  enabled = true,
  feeRate,
}: UseFeeEstimateParams): UseFeeEstimateReturn {
  // Start with quick estimate for immediate UI feedback
  const quickEstimate = useMemo(() => estimateTransactionFeeQuick(type, feeRate), [type, feeRate]);

  const [feeEstimate, setFeeEstimate] = useState<FeeEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeeEstimate = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const estimate = await estimateTransactionFee(type, sourceAddress, feeRate);
      setFeeEstimate(estimate);
    } catch (err) {
      setError('Failed to estimate fees');
      // Keep using quick estimate on error
    } finally {
      setIsLoading(false);
    }
  }, [type, sourceAddress, enabled, feeRate]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    if (enabled) {
      fetchFeeEstimate();
    }
  }, [fetchFeeEstimate, enabled]);

  // Return quick estimate while loading or on error
  const currentFeeEstimateSats = feeEstimate?.feeSats ?? quickEstimate;

  return {
    feeEstimateSats: currentFeeEstimateSats,
    feeEstimate,
    isLoading,
    error,
    refetch: fetchFeeEstimate,
  };
}
