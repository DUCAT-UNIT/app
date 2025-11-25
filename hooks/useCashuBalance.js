/**
 * useCashuBalance Hook
 * Handles Cashu balance fetching with fast initial load and background full load
 */

import { useState, useCallback, useEffect } from 'react';
import { logger } from '../utils/logger';
import { getBalance, setCurrentAccount } from '../services/cashu/cashuWalletService';
import { usePolling } from './usePolling';

export function useCashuBalance({ wallet }) {
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState(null);

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
          } catch (err) {
            logger.error('Failed to fetch full Cashu balance', { error: err.message });
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
    } catch (err) {
      logger.error('Failed to fetch Cashu balance', { error: err.message });
      setError(err.message);
      return balance;
    }
  }, [balance]);

  // Auto-refresh balance every 10 seconds
  usePolling({
    onPoll: fetchBalance,
    interval: 10000,
    enabled: true,
    immediate: false,
  });

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
