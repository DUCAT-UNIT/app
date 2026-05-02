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
  const mountedRef = useRef(true);
  const backgroundLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearBackgroundLoadTimer = useCallback(() => {
    if (backgroundLoadTimerRef.current) {
      clearTimeout(backgroundLoadTimerRef.current);
      backgroundLoadTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearBackgroundLoadTimer();
    };
  }, [clearBackgroundLoadTimer]);

  // Keep ref in sync with state (for error fallback return value)
  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  const fetchBalance = useCallback(async (fullLoad = true) => {
    if (!wallet?.taprootAddress) {
      if (mountedRef.current) {
        setBalance(0);
        setError(null);
      }
      return 0;
    }

    try {
      if (!fullLoad) {
        // Fast initial load - only first 25 proofs
        const quickBalance = await getBalance(false);
        if (mountedRef.current) {
          setBalance(quickBalance);
          setError(null);
        }

        // Load full balance in background
        clearBackgroundLoadTimer();
        backgroundLoadTimerRef.current = setTimeout(async () => {
          backgroundLoadTimerRef.current = null;
          try {
            const fullBalance = await getBalance(true);
            if (mountedRef.current) {
              setBalance(fullBalance);
            }
          } catch (err: unknown) {
            logger.error('Failed to fetch full Cashu balance', { error: err instanceof Error ? err.message : String(err) });
          }
        }, 100);
        (backgroundLoadTimerRef.current as { unref?: () => void }).unref?.();

        return quickBalance;
      } else {
        // Full load
        const newBalance = await getBalance(true);
        if (mountedRef.current) {
          setBalance(newBalance);
          setError(null);
        }
        return newBalance;
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Failed to fetch Cashu balance', { error: errorMessage });
      if (mountedRef.current) {
        setError(errorMessage);
      }
      return balanceRef.current;  // Use ref instead of state to avoid dependency loop
    }
  }, [wallet?.taprootAddress, clearBackgroundLoadTimer]);  // Safe: only changes on account/auth transitions

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
      initAccount().catch((initError: unknown) => {
        logger.error('[useCashuBalance] Failed to initialize Cashu account', {
          error: initError instanceof Error ? initError.message : String(initError),
        });
      });
    }
  }, [wallet?.taprootAddress, fetchBalance]);

  // Auto-refresh balance every 10 seconds
  usePolling({
    onPoll: fetchBalance,
    interval: 10000,
    enabled: Boolean(wallet?.taprootAddress),
    immediate: false,
  });

  // Subscribe to proof changes to trigger immediate balance refresh
  useEffect(() => {
    if (!wallet?.taprootAddress) {
      setBalance(0);
      setError(null);
      return;
    }

    const unsubscribe = subscribeToProofChanges(() => {
      logger.debug('[useCashuBalance] Proof change detected, refreshing balance');
      fetchBalance(true);
    });

    return unsubscribe;
  }, [fetchBalance, wallet?.taprootAddress]);

  return {
    balance,
    setBalance,
    error,
    setError,
    fetchBalance,
  };
}
