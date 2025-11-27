/**
 * useCashuBalance Hook
 * Handles Cashu balance fetching with fast initial load and background full load
 */

import { useState, useCallback, useEffect, useRef, Dispatch, SetStateAction } from 'react';
import { logger } from '../utils/logger';
import { getBalance, setCurrentAccount, subscribeToProofChanges } from '../services/cashu/cashuWalletService';
import { usePolling } from './usePolling';
import type { WalletAddresses } from '../contexts/WalletContext';

interface UseCashuBalanceParams {
  wallet: WalletAddresses | null;
}

interface UseCashuBalanceReturn {
  balance: number;
  setBalance: Dispatch<SetStateAction<number>>;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  fetchBalance: (fullLoad?: boolean) => Promise<number>;
}

export function useCashuBalance({ wallet }: UseCashuBalanceParams): UseCashuBalanceReturn {
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const balanceRef = useRef(0);  // Track balance for error fallback without causing dependency loops

  // Keep ref in sync with state (for error fallback return value)
  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  // Update cashu account when wallet changes (lightweight - just updates the account key)
  // NOTE: Balance reset and fetch is handled by useAccountSwitcher for snappier account switching
  useEffect(() => {
    if (wallet?.taprootAddress) {
      setCurrentAccount(wallet.taprootAddress);
    }
  }, [wallet?.taprootAddress]);

  const fetchBalance = useCallback(async (fullLoad = true) => {
    try {
      if (!fullLoad) {
        // Fast initial load - only first 25 proofs
        const quickBalance = await getBalance(false);
        setBalance(quickBalance);
        setError(null);

        // Load full balance in background
        setTimeout(async () => {
          try {
            const fullBalance = await getBalance(true);
            setBalance(fullBalance);
          } catch (err: unknown) {
            logger.error('Failed to fetch full Cashu balance', { error: err instanceof Error ? err.message : String(err) });
          }
        }, 100);

        return quickBalance;
      } else {
        // Full load
        const newBalance = await getBalance(true);
        setBalance(newBalance);
        setError(null);
        return newBalance;
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Failed to fetch Cashu balance', { error: errorMessage });
      setError(errorMessage);
      return balanceRef.current;  // Use ref instead of state to avoid dependency loop
    }
  }, []);  // Empty deps - uses ref for fallback value, avoiding the balance dependency

  // Auto-refresh balance every 10 seconds
  usePolling({
    onPoll: fetchBalance,
    interval: 10000,
    enabled: true,
    immediate: false,
  });

  // Subscribe to proof changes to trigger immediate balance refresh
  useEffect(() => {
    const unsubscribe = subscribeToProofChanges(() => {
      logger.debug('[useCashuBalance] Proof change detected, refreshing balance');
      fetchBalance(true);
    });

    return unsubscribe;
  }, [fetchBalance]);

  // Initial load - use fast loading
  useEffect(() => {
    fetchBalance(false);
  }, [fetchBalance]);

  return {
    balance,
    setBalance,
    error,
    setError,
    fetchBalance,
  };
}
