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

  // Update cashu account when wallet changes
  // Reset balance to 0 immediately, then set account and fetch correct balance
  useEffect(() => {
    if (wallet?.taprootAddress) {
      // Reset balance immediately to prevent showing stale data from wrong account
      setBalance(0);
      // Set account and then fetch balance (awaited to ensure correct storage key)
      const initAccount = async () => {
        await setCurrentAccount(wallet.taprootAddress);
        fetchBalance(false);
      };
      initAccount().catch((error: unknown) => {
        logger.error('[useCashuBalance] Failed to initialize Cashu account', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }, [wallet?.taprootAddress, fetchBalance]);

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

  return {
    balance,
    setBalance,
    error,
    setError,
    fetchBalance,
  };
}
