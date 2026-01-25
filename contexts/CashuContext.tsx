/**
 * CashuContext - Cashu e-cash wallet state management
 * Split into separate contexts for better performance:
 * - CashuBalanceContext: balance, loading, error (frequently read)
 * - CashuOperationsContext: operations (stable references)
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import { logger } from '../utils/logger';
import { clearWallet, setCurrentAccount } from '../services/cashu/cashuWalletService';
import { checkAndRecoverSwaps } from '../services/cashu/cashuSwapRecovery';
import { recoverUnclaimedMintQuotes } from '../services/cashu/cashuMintQuoteRecovery';
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
  addPendingMint: (quoteId: string, amount: number) => void;
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
 * Combined hook - returns all context values
 * Use useCashuBalanceState or useCashuOperations for better performance
 */
export const useCashu = (): CashuContextValue => {
  const balance = useCashuBalanceState();
  const operations = useCashuOperations();
  return { ...balance, ...operations };
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
  } = useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance, taprootAddress: wallet?.taprootAddress });

  /**
   * Add an externally-created mint quote to the pending mints list.
   * Used by the threshold conversion flow which creates its own quote
   * via useEcashThresholdManager but needs app-level polling to complete it.
   */
  const addPendingMint = useCallback((quoteId: string, amount: number) => {
    setPendingMints((prev) => {
      // Don't add duplicates
      if (prev.some(m => m.quoteId === quoteId)) {
        logger.debug('[CashuContext] addPendingMint: already exists', { quoteId: quoteId.substring(0, 8) });
        return prev;
      }
      logger.debug('[CashuContext] addPendingMint: adding to pending mints', { quoteId: quoteId.substring(0, 8), amount });
      return [
        ...prev,
        {
          quoteId,
          amount,
          depositAddress: '', // Not needed for completion polling
          state: 'UNPAID',
          createdAt: Date.now(),
        },
      ];
    });
  }, [setPendingMints]);

  // Track wallet for reference (account switch reset is handled by useAccountSwitcher)
  useEffect(() => {
    prevWalletRef.current = wallet;
  }, [wallet]);

  // Check for and recover any pending swap/mint transactions on startup
  const recoveryChecked = useRef(false);
  useEffect(() => {
    if (recoveryChecked.current || !wallet?.taprootAddress) {
      return;
    }
    recoveryChecked.current = true;

    const runRecovery = async () => {
      try {
        // Check for pending swap recovery (proofs lost mid-swap)
        logger.info('[CashuContext] Checking for pending swap recovery...');
        await checkAndRecoverSwaps();

        // Check for unclaimed mint quotes (paid but not claimed)
        logger.info('[CashuContext] Checking for unclaimed mint quotes...');
        const mintRecovery = await recoverUnclaimedMintQuotes();
        if (mintRecovery.recovered > 0) {
          logger.info('[CashuContext] Recovered unclaimed mint quotes on startup', {
            recovered: mintRecovery.recovered,
            totalAmount: mintRecovery.totalAmountRecovered,
          });
        }

        // Refresh balance after potential recovery
        await fetchBalance();
      } catch (error) {
        logger.error('[CashuContext] Recovery check failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    runRecovery();
  }, [wallet?.taprootAddress, fetchBalance]);

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
    } catch (err: unknown) {
      if (err instanceof Error) {
        logger.error('Failed to reset wallet', { error: err.message });
      }
      throw err;
    }
  }, [setBalance, setPendingMints, setError]);

  /**
   * Refresh all data and recover any unclaimed mint quotes
   */
  const refresh = useCallback(async () => {
    // First, check for any paid but unclaimed mint quotes
    try {
      logger.info('[CashuContext] Checking for unclaimed mint quotes...');
      const recoveryResult = await recoverUnclaimedMintQuotes();

      if (recoveryResult.recovered > 0) {
        logger.info('[CashuContext] Recovered unclaimed mint quotes', {
          recovered: recoveryResult.recovered,
          totalAmount: recoveryResult.totalAmountRecovered,
        });
      }
    } catch (error) {
      logger.error('[CashuContext] Mint quote recovery failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Also check for swap recovery
    try {
      await checkAndRecoverSwaps();
    } catch (error) {
      logger.error('[CashuContext] Swap recovery failed during refresh', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Finally, refresh balance
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
    startMint,
    checkAndCompleteMint,
    removePendingMint,
    addPendingMint,
    autoMint,
    receive,
    send,
    startMelt,
    finishMelt,
    refresh,
    resetAndRefresh,
    reset,
  }), [
    startMint, checkAndCompleteMint, removePendingMint, addPendingMint, autoMint,
    receive, send, startMelt, finishMelt, refresh, resetAndRefresh, reset,
  ]);

  return (
    <CashuBalanceContext.Provider value={balanceValue}>
      <CashuOperationsContext.Provider value={operationsValue}>
        {children}
      </CashuOperationsContext.Provider>
    </CashuBalanceContext.Provider>
  );
};

export default CashuProvider;
