/**
 * WalletDataContext - Consolidated wallet data management
 * Merges BalanceContext, TransactionHistoryContext, and VaultDataContext
 * Manages all wallet-related data fetching with unified auto-refresh logic
 */

import React, { createContext, useContext, useEffect, useCallback, useMemo, useRef } from 'react';
import { useWallet } from './WalletContext';
import { usePendingTransactions } from './PendingTransactionsContext';
import { usePolling } from '../hooks/usePolling';
import { useBalanceData } from '../hooks/useBalanceData';
import { useTransactionHistoryFetch } from '../hooks/useTransactionHistoryFetch';
import { useVaultDataFetch } from '../hooks/useVaultDataFetch';

// Polling intervals (in milliseconds)
const POLL_INTERVAL = 10000; // 10 seconds - for balance and vault data
const HISTORY_POLL_INTERVAL = 30000; // 30 seconds - for transaction history

const WalletDataContext = createContext();

export const useWalletData = () => {
  const context = useContext(WalletDataContext);
  if (!context) {
    throw new Error('useWalletData must be used within a WalletDataProvider');
  }
  return context;
};

// Backwards compatibility hooks
export const useBalance = () => {
  const { balance } = useWalletData();
  return balance;
};

export const useTransactionHistory = () => {
  const { history } = useWalletData();
  return history;
};

export const useVaultData = () => {
  const { vault } = useWalletData();
  return vault;
};

export const WalletDataProvider = ({ children }) => {
  const { wallet } = useWallet();
  const { getUnconfirmedBalance } = usePendingTransactions();

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

  // Track last transaction history fetch time for less frequent polling
  const lastHistoryFetchRef = useRef(0);
  // Track previous wallet to detect changes (account switches)
  const prevWalletRef = useRef(null);

  // Unified polling callback - fetches all data on a coordinated schedule
  const pollAllData = useCallback(() => {
    if (!wallet) return;

    // Always fetch balance and vault together (every 10s)
    balance.fetchBalance();
    vault.fetchVault();

    // Fetch transaction history less frequently
    const now = Date.now();
    if (now - lastHistoryFetchRef.current >= HISTORY_POLL_INTERVAL) {
      history.fetchTransactionHistory();
      lastHistoryFetchRef.current = now;
    }
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
      lastHistoryFetchRef.current = 0;
    } else if (prevWallet && wallet &&
               (prevWallet.segwitAddress !== wallet.segwitAddress ||
                prevWallet.taprootAddress !== wallet.taprootAddress ||
                prevWallet.taprootPubkey !== wallet.taprootPubkey)) {
      // Wallet changed (account switch) - immediately fetch all data
      balance.fetchBalance();
      vault.fetchVault();
      history.fetchTransactionHistory();
      lastHistoryFetchRef.current = Date.now();
    }
    // Note: On initial mount (prevWallet is null), we rely on usePolling's immediate: true
  }, [wallet, balance.resetBalances, balance.fetchBalance, history.resetTransactionHistory, history.fetchTransactionHistory, vault.resetVaultData, vault.fetchVault]);

  // Single unified polling mechanism
  usePolling({
    onPoll: pollAllData,
    interval: POLL_INTERVAL,
    enabled: !!wallet,
    immediate: true,
  });

  // ============================================================
  // CONSOLIDATED VALUE (MEMOIZED)
  // ============================================================
  // Memoize the value object to prevent unnecessary re-renders of consumers
  // Split dependencies to only update when specific parts change
  const value = useMemo(
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
    [
      // Balance dependencies
      balance.segwitBalance,
      balance.taprootBalance,
      balance.runesBalance,
      balance.unconfirmedSegwitBalance,
      balance.unconfirmedTaprootBalance,
      balance.unconfirmedRunesBalance,
      balance.loadingBalance,
      balance.refreshing,
      balance.balanceError,
      balance.setBalanceError,
      balance.utxos,
      balance.loadingUtxos,
      balance.fetchBalance,
      balance.onRefresh,
      balance.fetchUtxos,
      balance.resetBalances,
      // History dependencies
      history.transactionHistory,
      history.loadingTransactionHistory,
      history.historyError,
      history.fetchTransactionHistory,
      history.resetTransactionHistory,
      // Vault dependencies
      vault.vaultData,
      vault.loadingVault,
      vault.vaultError,
      vault.fetchVault,
      vault.resetVaultData,
    ]
  );

  return <WalletDataContext.Provider value={value}>{children}</WalletDataContext.Provider>;
};
