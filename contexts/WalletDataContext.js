/**
 * WalletDataContext - Consolidated wallet data management
 * Merges BalanceContext, TransactionHistoryContext, and VaultDataContext
 * Manages all wallet-related data fetching with unified auto-refresh logic
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchWalletBalances, fetchUtxos as fetchUtxosService } from '../services/balanceService';
import { fetchAllTransactionHistory } from '../services/transactionHistoryService';
import { fetchVaultData } from '../services/vaultService';
import { useWallet } from './WalletContext';
import { usePendingTransactions } from './PendingTransactionsContext';
import { usePolling } from '../hooks/usePolling';

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
  // BALANCE STATE
  // ============================================================
  const [segwitBalance, setSegwitBalance] = useState(0);
  const [taprootBalance, setTaprootBalance] = useState(0);
  const [runesBalance, setRunesBalance] = useState([]);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [balanceError, setBalanceError] = useState(null);

  // Unconfirmed balance from pending transactions
  const [unconfirmedSegwitBalance, setUnconfirmedSegwitBalance] = useState(0);
  const [unconfirmedTaprootBalance, setUnconfirmedTaprootBalance] = useState(0);
  const [unconfirmedRunesBalance, setUnconfirmedRunesBalance] = useState(0);

  // UTXOs state
  const [utxos, setUtxos] = useState([]);
  const [loadingUtxos, setLoadingUtxos] = useState(false);

  // ============================================================
  // TRANSACTION HISTORY STATE
  // ============================================================
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [loadingTransactionHistory, setLoadingTransactionHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  // ============================================================
  // VAULT DATA STATE
  // ============================================================
  const [vaultData, setVaultData] = useState(null);
  const [loadingVault, setLoadingVault] = useState(false);
  const [vaultError, setVaultError] = useState(null);

  // ============================================================
  // BALANCE FUNCTIONS
  // ============================================================

  // Fetch wallet balance
  const fetchBalance = useCallback(
    async (segwitAddr, taprootAddr) => {
      // If addresses are provided, use them; otherwise use wallet state
      const segwitAddress = segwitAddr || wallet?.segwitAddress;
      const taprootAddress = taprootAddr || wallet?.taprootAddress;

      if (!segwitAddress || !taprootAddress) return;

      try {
        setLoadingBalance(true);
        setBalanceError(null); // Clear previous error
        const balances = await fetchWalletBalances(segwitAddress, taprootAddress);
        setSegwitBalance(balances.segwitBalance);
        setTaprootBalance(balances.taprootBalance);
        setRunesBalance(balances.runesBalance);

        // Also fetch unconfirmed balances from pending transactions
        const unconfirmedSegwit = getUnconfirmedBalance('segwit');
        const unconfirmedTaproot = getUnconfirmedBalance('taproot');
        setUnconfirmedSegwitBalance(unconfirmedSegwit.btc);
        setUnconfirmedTaprootBalance(unconfirmedTaproot.btc);
        setUnconfirmedRunesBalance(unconfirmedTaproot.runes);
      } catch (error) {
        // Set error state instead of silently failing with 0
        setBalanceError('Failed to fetch balance. Tap to retry.');
        // Don't reset balances to 0 - keep last known values
      } finally {
        setLoadingBalance(false);
      }
    },
    [wallet, getUnconfirmedBalance]
  );

  // Refresh balances (pull-to-refresh)
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBalance();
    setRefreshing(false);
  }, [fetchBalance]);

  // Fetch UTXOs for transaction creation
  const fetchUtxos = useCallback(async (address) => {
    try {
      setLoadingUtxos(true);
      const formattedUtxos = await fetchUtxosService(address);
      setUtxos(formattedUtxos);
      return formattedUtxos;
    } catch (error) {
      throw error;
    } finally {
      setLoadingUtxos(false);
    }
  }, []);

  // Reset balances (called when wallet is reset)
  const resetBalances = useCallback(() => {
    setSegwitBalance(0);
    setTaprootBalance(0);
    setRunesBalance([]);
    setUtxos([]);
  }, []);

  // ============================================================
  // TRANSACTION HISTORY FUNCTIONS
  // ============================================================

  /**
   * Fetch transaction history in background
   * Fetches from both blockchain addresses and vault API
   */
  const fetchTransactionHistory = useCallback(async () => {
    const segwitAddress = wallet?.segwitAddress;
    const taprootAddress = wallet?.taprootAddress;
    const vaultPubkey = wallet?.taprootPubkey;

    if (!segwitAddress || !taprootAddress || !vaultPubkey) return;

    try {
      console.log('🔄 Fetching fresh transaction history from blockchain API...');
      console.log('  - Segwit address:', segwitAddress);
      console.log('  - Taproot address:', taprootAddress);
      setLoadingTransactionHistory(true);
      setHistoryError(null); // Clear previous error
      const history = await fetchAllTransactionHistory(segwitAddress, taprootAddress, vaultPubkey);
      console.log('✅ Fetched', history.length, 'transactions (including pending)');
      setTransactionHistory(history);
    } catch (error) {
      console.error('❌ Failed to fetch transaction history:', error);
      // Set error state instead of silently failing with empty array
      setHistoryError('Failed to fetch transaction history');
      // Don't reset history - keep last known values
    } finally {
      setLoadingTransactionHistory(false);
    }
  }, [wallet]);

  /**
   * Reset transaction history (called when wallet is reset)
   */
  const resetTransactionHistory = useCallback(() => {
    setTransactionHistory([]);
  }, []);

  // ============================================================
  // VAULT DATA FUNCTIONS
  // ============================================================

  /**
   * Fetch vault data from validator API
   */
  const fetchVault = useCallback(async () => {
    const vaultPubkey = wallet?.taprootPubkey;

    if (!vaultPubkey) {
      console.log('⚠️ fetchVault: No wallet or taprootPubkey available');
      return;
    }

    console.log('🏦 WalletDataContext: Starting vault fetch for pubkey:', vaultPubkey);

    try {
      setLoadingVault(true);
      setVaultError(null); // Clear previous error
      const data = await fetchVaultData(vaultPubkey);
      console.log('🏦 WalletDataContext: Vault data received:', data ? 'Data exists' : 'null (no vault)');
      setVaultData(data);
    } catch (error) {
      console.error('❌ WalletDataContext: Error fetching vault data:', error);
      // Set error state instead of silently failing
      setVaultError('Failed to fetch vault data');
      // Don't reset vault data - keep last known values
    } finally {
      setLoadingVault(false);
    }
  }, [wallet]);

  /**
   * Reset vault data (called when wallet is reset)
   */
  const resetVaultData = useCallback(() => {
    setVaultData(null);
  }, []);

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
    fetchBalance();
    fetchVault();

    // Fetch transaction history less frequently (every 30s)
    const now = Date.now();
    if (now - lastHistoryFetchRef.current >= 30000) {
      fetchTransactionHistory();
      lastHistoryFetchRef.current = now;
    }
  }, [wallet, fetchBalance, fetchVault, fetchTransactionHistory]);

  // Handle wallet changes - reset data when removed, fetch immediately when changed
  useEffect(() => {
    const prevWallet = prevWalletRef.current;
    prevWalletRef.current = wallet;

    if (!wallet) {
      // Wallet removed - reset all data
      resetBalances();
      resetTransactionHistory();
      resetVaultData();
      lastHistoryFetchRef.current = 0;
    } else if (prevWallet && wallet &&
               (prevWallet.segwitAddress !== wallet.segwitAddress ||
                prevWallet.taprootAddress !== wallet.taprootAddress ||
                prevWallet.taprootPubkey !== wallet.taprootPubkey)) {
      // Wallet changed (account switch) - immediately fetch all data
      console.log('🔄 Account switch detected - fetching all data for new account');
      fetchBalance();
      fetchVault();
      fetchTransactionHistory();
      lastHistoryFetchRef.current = Date.now();
    }
    // Note: On initial mount (prevWallet is null), we rely on usePolling's immediate: true
  }, [wallet, resetBalances, resetTransactionHistory, resetVaultData, fetchBalance, fetchVault, fetchTransactionHistory]);

  // Single unified polling mechanism (10 second interval)
  usePolling({
    onPoll: pollAllData,
    interval: 10000,
    enabled: !!wallet,
    immediate: true,
  });

  // ============================================================
  // CONSOLIDATED VALUE (MEMOIZED)
  // ============================================================
  // Memoize the value object to prevent unnecessary re-renders of consumers
  // Only recreate when actual data or functions change
  const value = useMemo(
    () => ({
      // Balance namespace
      balance: {
        segwitBalance,
        taprootBalance,
        runesBalance,
        unconfirmedSegwitBalance,
        unconfirmedTaprootBalance,
        unconfirmedRunesBalance,
        loadingBalance,
        refreshing,
        balanceError,
        utxos,
        loadingUtxos,
        fetchBalance,
        onRefresh,
        fetchUtxos,
        resetBalances,
      },
      // Transaction history namespace
      history: {
        transactionHistory,
        loadingTransactionHistory,
        historyError,
        fetchTransactionHistory,
        resetTransactionHistory,
      },
      // Vault data namespace
      vault: {
        vaultData,
        loadingVault,
        vaultError,
        fetchVault,
        resetVaultData,
      },
      // Direct exports for backwards compatibility
      segwitBalance,
      taprootBalance,
      runesBalance,
      unconfirmedSegwitBalance,
      unconfirmedTaprootBalance,
      unconfirmedRunesBalance,
      loadingBalance,
      refreshing,
      balanceError,
      setBalanceError,
      utxos,
      loadingUtxos,
      fetchBalance,
      onRefresh,
      fetchUtxos,
      resetBalances,
      transactionHistory,
      loadingTransactionHistory,
      historyError,
      fetchTransactionHistory,
      resetTransactionHistory,
      vaultData,
      loadingVault,
      vaultError,
      fetchVault,
      resetVaultData,
    }),
    [
      // All state dependencies
      segwitBalance,
      taprootBalance,
      runesBalance,
      unconfirmedSegwitBalance,
      unconfirmedTaprootBalance,
      unconfirmedRunesBalance,
      loadingBalance,
      refreshing,
      balanceError,
      utxos,
      loadingUtxos,
      transactionHistory,
      loadingTransactionHistory,
      historyError,
      vaultData,
      loadingVault,
      vaultError,
      // All function dependencies (already memoized with useCallback)
      fetchBalance,
      onRefresh,
      fetchUtxos,
      resetBalances,
      fetchTransactionHistory,
      resetTransactionHistory,
      fetchVault,
      resetVaultData,
    ]
  );

  return <WalletDataContext.Provider value={value}>{children}</WalletDataContext.Provider>;
};
