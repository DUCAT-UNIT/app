/**
 * WalletDataContext - Consolidated wallet data management
 * Merges BalanceContext, TransactionHistoryContext, and VaultDataContext
 * Manages all wallet-related data fetching with unified auto-refresh logic
 */

import React, { createContext, useContext, useEffect, useCallback, useMemo, useRef } from 'react';
import { useWallet } from './WalletContext';
import { usePendingTransactions } from './PendingTransactionsContext';
import { useCashu } from './CashuContext';
import { usePolling } from '../hooks/usePolling';
import { useBalanceData } from '../hooks/useBalanceData';
import { useTransactionHistoryFetch } from '../hooks/useTransactionHistoryFetch';
import { useVaultDataFetch } from '../hooks/useVaultDataFetch';
import { logger } from '../utils/logger';

// Polling intervals (in milliseconds)
const POLL_INTERVAL = 10000; // 10 seconds - for balance and vault data

// PERFORMANCE: Split into 3 separate contexts to prevent unnecessary re-renders
// When balance changes, only components using useBalance() will re-render
// When history changes, only components using useTransactionHistory() will re-render
// When vault changes, only components using useVaultData() will re-render
const BalanceContext = createContext();
const HistoryContext = createContext();
const VaultContext = createContext();
const WalletDataContext = createContext(); // Legacy - for backwards compatibility

export const useWalletData = () => {
  const context = useContext(WalletDataContext);
  if (!context) {
    throw new Error('useWalletData must be used within a WalletDataProvider');
  }
  return context;
};

// OPTIMIZED: Direct context access - no re-render unless balance changes
export const useBalance = () => {
  const context = useContext(BalanceContext);
  if (!context) {
    throw new Error('useBalance must be used within a WalletDataProvider');
  }
  return context;
};

// OPTIMIZED: Direct context access - no re-render unless history changes
export const useTransactionHistory = () => {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useTransactionHistory must be used within a WalletDataProvider');
  }
  return context;
};

// OPTIMIZED: Direct context access - no re-render unless vault changes
export const useVaultData = () => {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error('useVaultData must be used within a WalletDataProvider');
  }
  return context;
};

export const WalletDataProvider = ({ children }) => {
  const { wallet } = useWallet();
  const { getUnconfirmedBalance } = usePendingTransactions();
  const { isLoading: loadingCashu, balance: cashuBalance } = useCashu();

  // ============================================================
  // USE EXTRACTED HOOKS FOR DATA MANAGEMENT
  // ============================================================

  // Balance data hook
  const balance = useBalanceData(wallet, getUnconfirmedBalance);

  // Transaction history data hook
  const history = useTransactionHistoryFetch(wallet);

  // Vault data hook
  const vault = useVaultDataFetch(wallet);

  // ============================================================
  // UNIFIED AUTO-REFRESH POLLING
  // ============================================================

  // Track previous wallet to detect changes (account switches)
  const prevWalletRef = useRef(null);

  // Track if initial balances have loaded (both runes and cashu)
  const initialBalancesLoadedRef = useRef(false);

  // Check if both balances have loaded at least once
  const hasRunesData = balance.runesBalance && balance.runesBalance.length >= 0;
  const hasCashuData = cashuBalance !== null && cashuBalance !== undefined;
  const bothBalancesLoaded = hasRunesData && hasCashuData;

  // Update ref when both balances have loaded
  if (bothBalancesLoaded && !initialBalancesLoadedRef.current) {
    logger.debug('[WalletDataContext] Both balances loaded, enabling transaction history fetch', {
      runesBalance: balance.runesBalance,
      cashuBalance,
    });
    initialBalancesLoadedRef.current = true;
  }

  // Unified polling callback - fetches all data on a coordinated schedule
  const pollAllData = useCallback(() => {
    if (!wallet) return;

    // Always fetch balance and vault
    balance.fetchBalance();
    vault.fetchVault();

    // Only fetch transaction history after both balances have loaded at least once
    if (initialBalancesLoadedRef.current) {
      history.fetchTransactionHistory();
    } else {
      logger.debug('[WalletDataContext] Skipping transaction history - waiting for balances to load', {
        hasRunesData,
        hasCashuData,
        loadingBalance: balance.loadingBalance,
        loadingCashu,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, balance.fetchBalance, vault.fetchVault, history.fetchTransactionHistory]);

  // Handle wallet changes - reset data when removed, fetch immediately when changed
  useEffect(() => {
    const prevWallet = prevWalletRef.current;
    prevWalletRef.current = wallet;

    if (!wallet) {
      // Wallet removed - reset all data
      balance.resetBalances();
      history.resetTransactionHistory();
      vault.resetVaultData();
      initialBalancesLoadedRef.current = false; // Reset flag
    } else if (prevWallet && wallet &&
               (prevWallet.segwitAddress !== wallet.segwitAddress ||
                prevWallet.taprootAddress !== wallet.taprootAddress ||
                prevWallet.taprootPubkey !== wallet.taprootPubkey)) {
      // Wallet changed (account switch) - reset flag and fetch balances first
      initialBalancesLoadedRef.current = false;
      balance.fetchBalance();
      vault.fetchVault();
      // Transaction history will be fetched by pollAllData once balances load
    } else if (!prevWallet && wallet) {
      // Wallet just loaded for first time (import/creation) - fetch balances first
      // Transaction history will be fetched by pollAllData once balances load
      balance.fetchBalance();
      vault.fetchVault();
    }
    // Note: The usePolling's immediate: true will also fire, but fetchBalance is idempotent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, balance.resetBalances, balance.fetchBalance, history.resetTransactionHistory, history.fetchTransactionHistory, vault.resetVaultData, vault.fetchVault]);

  // Trigger initial transaction history load once both balances have loaded
  useEffect(() => {
    if (bothBalancesLoaded && initialBalancesLoadedRef.current) {
      logger.debug('[WalletDataContext] Both balances ready - fetching transaction history');
      history.fetchTransactionHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bothBalancesLoaded]);

  // Single unified polling mechanism
  usePolling({
    onPoll: pollAllData,
    interval: POLL_INTERVAL,
    enabled: !!wallet,
    immediate: true,
  });

  // ============================================================
  // PERFORMANCE OPTIMIZATION: 3 Separate Memoized Values
  // ============================================================
  // Each value is memoized independently - only changes when its own data changes
  // This prevents cross-contamination of re-renders

  // Balance context value - only updates when balance data changes
  const balanceValue = useMemo(() => balance, [balance]);

  // History context value - only updates when history data changes
  const historyValue = useMemo(() => history, [history]);

  // Vault context value - only updates when vault data changes
  const vaultValue = useMemo(() => vault, [vault]);

  // Legacy consolidated value (for backwards compatibility with useWalletData())
  // This still has the old behavior - updates when ANY data changes
  const legacyValue = useMemo(
    () => ({
      // Namespaced data (recommended for new code)
      balance,
      history,
      vault,
      // Direct exports for backwards compatibility
      segwitBalance: balance.segwitBalance,
      taprootBalance: balance.taprootBalance,
      runesBalance: balance.runesBalance,
      unconfirmedSegwitBalance: balance.unconfirmedSegwitBalance,
      unconfirmedTaprootBalance: balance.unconfirmedTaprootBalance,
      unconfirmedRunesBalance: balance.unconfirmedRunesBalance,
      loadingBalance: balance.loadingBalance,
      refreshing: balance.refreshing,
      balanceError: balance.balanceError,
      setBalanceError: balance.setBalanceError,
      utxos: balance.utxos,
      loadingUtxos: balance.loadingUtxos,
      fetchBalance: balance.fetchBalance,
      onRefresh: balance.onRefresh,
      fetchUtxos: balance.fetchUtxos,
      resetBalances: balance.resetBalances,
      transactionHistory: history.transactionHistory,
      loadingTransactionHistory: history.loadingTransactionHistory,
      historyError: history.historyError,
      fetchTransactionHistory: history.fetchTransactionHistory,
      resetTransactionHistory: history.resetTransactionHistory,
      vaultData: vault.vaultData,
      loadingVault: vault.loadingVault,
      vaultError: vault.vaultError,
      fetchVault: vault.fetchVault,
      resetVaultData: vault.resetVaultData,
    }),
    [balance, history, vault]
  );

  return (
    <BalanceContext.Provider value={balanceValue}>
      <HistoryContext.Provider value={historyValue}>
        <VaultContext.Provider value={vaultValue}>
          <WalletDataContext.Provider value={legacyValue}>{children}</WalletDataContext.Provider>
        </VaultContext.Provider>
      </HistoryContext.Provider>
    </BalanceContext.Provider>
  );
};
