/**
 * CashuContext - Cashu e-cash wallet state management
 * Split into separate contexts for better performance:
 * - CashuBalanceContext: balance, loading, error (frequently read)
 * - CashuOperationsContext: operations (stable references)
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { logger } from '../utils/logger';
import { clearWallet } from '../services/cashu/cashuWalletService';
import { useWallet } from './WalletContext';
import { useCashuBalance } from '../hooks/useCashuBalance';
import { useCashuMint } from '../hooks/useCashuMint';
import { useCashuMelt } from '../hooks/useCashuMelt';
import { useCashuSendReceive } from '../hooks/useCashuSendReceive';

// Separate contexts for different update frequencies
const CashuBalanceContext = createContext();
const CashuOperationsContext = createContext();

// Legacy context for backwards compatibility
const CashuContext = createContext();

/**
 * Hook for balance-related state (frequently updated)
 */
export const useCashuBalanceState = () => {
  const context = useContext(CashuBalanceContext);
  if (!context) {
    throw new Error('useCashuBalanceState must be used within a CashuProvider');
  }
  return context;
};

/**
 * Hook for operations (stable references, rarely changes)
 */
export const useCashuOperations = () => {
  const context = useContext(CashuOperationsContext);
  if (!context) {
    throw new Error('useCashuOperations must be used within a CashuProvider');
  }
  return context;
};

/**
 * Legacy hook - returns all context values
 * Use useCashuBalanceState or useCashuOperations for better performance
 */
export const useCashu = () => {
  const context = useContext(CashuContext);
  if (!context) {
    throw new Error('useCashu must be used within a CashuProvider');
  }
  return context;
};

export const CashuProvider = ({ children }) => {
  const { wallet } = useWallet();
  const [isLoading, setIsLoading] = useState(false);

  // Balance management
  const {
    balance,
    setBalance,
    error,
    setError,
    fetchBalance,
  } = useCashuBalance({ wallet });

  // Mint operations
  const {
    pendingMints,
    startMint,
    checkAndCompleteMint,
    removePendingMint,
    autoMint,
    setPendingMints,
  } = useCashuMint({ fetchBalance, setIsLoading, setError });

  // Melt operations
  const {
    startMelt,
    finishMelt,
  } = useCashuMelt({ setIsLoading, setError, setBalance });

  // Send/Receive operations
  const {
    receive,
    send,
  } = useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance });

  /**
   * Clear all Cashu proofs (for testing/reset)
   */
  const reset = useCallback(async () => {
    try {
      await clearWallet();
      setBalance(0);
      setPendingMints([]);
      setError(null);
      logger.info('Cashu wallet reset');
    } catch (err) {
      logger.error('Failed to reset wallet', { error: err.message });
      throw err;
    }
  }, [setBalance, setPendingMints, setError]);

  /**
   * Refresh all data
   */
  const refresh = useCallback(async () => {
    await fetchBalance();
  }, [fetchBalance]);

  // Memoize balance context value (changes frequently)
  const balanceValue = useMemo(() => ({
    balance,
    isLoading,
    error,
    pendingMints,
  }), [balance, isLoading, error, pendingMints]);

  // Memoize operations context value (stable references)
  const operationsValue = useMemo(() => ({
    // Mint operations
    startMint,
    checkAndCompleteMint,
    removePendingMint,
    autoMint,
    // Receive/Send
    receive,
    send,
    // Melt operations
    startMelt,
    finishMelt,
    // Wallet management
    refresh,
    reset,
  }), [
    startMint,
    checkAndCompleteMint,
    removePendingMint,
    autoMint,
    receive,
    send,
    startMelt,
    finishMelt,
    refresh,
    reset,
  ]);

  // Legacy combined value for backwards compatibility
  const legacyValue = useMemo(() => ({
    ...balanceValue,
    ...operationsValue,
  }), [balanceValue, operationsValue]);

  return (
    <CashuBalanceContext.Provider value={balanceValue}>
      <CashuOperationsContext.Provider value={operationsValue}>
        <CashuContext.Provider value={legacyValue}>
          {children}
        </CashuContext.Provider>
      </CashuOperationsContext.Provider>
    </CashuBalanceContext.Provider>
  );
};

export default CashuProvider;
