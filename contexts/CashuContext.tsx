/**
 * CashuContext - Cashu e-cash wallet state management
 * Split into separate contexts for better performance:
 * - CashuBalanceContext: balance, loading, error (frequently read)
 * - CashuOperationsContext: operations (stable references)
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import { logger } from '../utils/logger';
import { clearWallet, setCurrentAccount } from '../services/cashu/cashuWalletService';
import { useWallet } from './WalletContext';
import { useCashuBalance } from '../hooks/useCashuBalance';
import { useCashuMint } from '../hooks/useCashuMint';
import { useCashuMelt } from '../hooks/useCashuMelt';
import { useCashuSendReceive } from '../hooks/useCashuSendReceive';
import type { MintQuoteResult } from '../services/cashu/operations/cashuMintOperations';
import type { MeltQuoteResult, MeltResult } from '../services/cashu/operations/cashuMeltOperations';
import type { SendTokenResult } from '../services/cashu/operations/cashuSendToken';
import type { ReceiveTokenResult } from '../services/cashu/operations/cashuReceiveToken';

export interface PendingMint {
  quoteId: string;
  amount: number;
  createdAt: number;
  [key: string]: unknown;
}

export interface CashuBalanceValue {
  balance: number;
  isLoading: boolean;
  error: string | null;
  pendingMints: PendingMint[];
}

export interface MintCheckResult {
  completed: boolean;
  proofs?: unknown[];
  amount?: number;
  state?: string;
}

interface AutoMintSuccessData {
  address: string;
  amount: number;
  quoteId: string;
}

export interface CashuOperationsValue {
  startMint: (amount: number) => Promise<MintQuoteResult>;
  checkAndCompleteMint: (quoteId: string) => Promise<MintCheckResult>;
  removePendingMint: (quoteId: string) => void;
  autoMint: (amountSats: number, onSuccess?: (data: AutoMintSuccessData) => void) => Promise<MintQuoteResult>;
  receive: (token: string) => Promise<ReceiveTokenResult>;
  send: (amount: number) => Promise<SendTokenResult>;
  startMelt: (address: string, amount: number) => Promise<MeltQuoteResult>;
  finishMelt: (quoteId: string, totalAmount: number) => Promise<MeltResult>;
  refresh: () => Promise<void>;
  resetAndRefresh: (newTaprootAddress?: string) => Promise<void>;
  reset: () => Promise<void>;
}

export type CashuContextValue = CashuBalanceValue & CashuOperationsValue;

// Separate contexts for different update frequencies
const CashuBalanceContext = createContext<CashuBalanceValue | undefined>(undefined);
const CashuOperationsContext = createContext<CashuOperationsValue | undefined>(undefined);

// Legacy context for backwards compatibility
const CashuContext = createContext<CashuContextValue | undefined>(undefined);

/**
 * Hook for balance-related state (frequently updated)
 */
export const useCashuBalanceState = (): CashuBalanceValue => {
  const context = useContext(CashuBalanceContext);
  if (!context) {
    throw new Error('useCashuBalanceState must be used within a CashuProvider');
  }
  return context;
};

/**
 * Hook for operations (stable references, rarely changes)
 */
export const useCashuOperations = (): CashuOperationsValue => {
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
export const useCashu = (): CashuContextValue => {
  const context = useContext(CashuContext);
  if (!context) {
    throw new Error('useCashu must be used within a CashuProvider');
  }
  return context;
};

interface CashuProviderProps {
  children: ReactNode;
}

export const CashuProvider: React.FC<CashuProviderProps> = ({ children }) => {
  const { wallet } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const prevWalletRef = useRef<typeof wallet | null>(null);

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

  // Track wallet for reference (account switch reset is handled by useAccountSwitcher)
  useEffect(() => {
    prevWalletRef.current = wallet;
  }, [wallet]);

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
      if (err instanceof Error) {
        logger.error('Failed to reset wallet', { error: err.message });
      }
      throw err;
    }
  }, [setBalance, setPendingMints, setError]);

  /**
   * Refresh all data
   */
  const refresh = useCallback(async () => {
    await fetchBalance();
  }, [fetchBalance]);

  /**
   * Reset and refresh for account switching
   * Called by useAccountSwitcher to ensure clean state
   */
  const resetAndRefresh = useCallback(async (newTaprootAddress?: string) => {
    // Reset state immediately (synchronous) for snappy UI
    setBalance(0);
    setPendingMints([]);
    setError(null);

    // CRITICAL: Set the current account BEFORE fetching balance
    // This ensures we read from the correct storage key
    if (newTaprootAddress) {
      setCurrentAccount(newTaprootAddress);
      logger.debug('[CashuContext] resetAndRefresh: Set current account to', { address: newTaprootAddress.substring(0, 20) + '...' });
    }

    // Then fetch fresh balance from the correct account
    await fetchBalance();
  }, [setBalance, setPendingMints, setError, fetchBalance]);

  // Memoize balance context value (changes frequently)
  const balanceValue = useMemo((): CashuBalanceValue => ({
    balance,
    isLoading,
    error,
    pendingMints: pendingMints as PendingMint[],
  }), [balance, isLoading, error, pendingMints]);

  // Memoize operations context value (stable references)
  const operationsValue = useMemo((): CashuOperationsValue => ({
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
    resetAndRefresh,
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
    resetAndRefresh,
    reset,
  ]);

  // Legacy combined value for backwards compatibility
  const legacyValue = useMemo((): CashuContextValue => ({
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
