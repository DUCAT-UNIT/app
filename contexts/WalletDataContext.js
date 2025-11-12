/**
 * WalletDataContext - Consolidated wallet data management
 * Merges BalanceContext, TransactionHistoryContext, and VaultDataContext
 * Manages all wallet-related data fetching with unified auto-refresh logic
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchWalletBalances, fetchUtxos as fetchUtxosService } from '../services/balanceService';
import { fetchAllTransactionHistory } from '../services/transactionHistoryService';
import { fetchVaultData } from '../services/vaultService';
import { useWallet } from './WalletContext';

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

  // ============================================================
  // BALANCE STATE
  // ============================================================
  const [segwitBalance, setSegwitBalance] = useState(0);
  const [taprootBalance, setTaprootBalance] = useState(0);
  const [runesBalance, setRunesBalance] = useState([]);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // UTXOs state
  const [utxos, setUtxos] = useState([]);
  const [loadingUtxos, setLoadingUtxos] = useState(false);

  // ============================================================
  // TRANSACTION HISTORY STATE
  // ============================================================
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [loadingTransactionHistory, setLoadingTransactionHistory] = useState(false);

  // ============================================================
  // VAULT DATA STATE
  // ============================================================
  const [vaultData, setVaultData] = useState(null);
  const [loadingVault, setLoadingVault] = useState(false);

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
        const balances = await fetchWalletBalances(segwitAddress, taprootAddress);
        setSegwitBalance(balances.segwitBalance);
        setTaprootBalance(balances.taprootBalance);
        setRunesBalance(balances.runesBalance);
      } catch (error) {
        setSegwitBalance(0);
        setTaprootBalance(0);
        setRunesBalance([]);
      } finally {
        setLoadingBalance(false);
      }
    },
    [wallet]
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
      setLoadingTransactionHistory(true);
      const history = await fetchAllTransactionHistory(segwitAddress, taprootAddress, vaultPubkey);
      setTransactionHistory(history);
    } catch (error) {
      setTransactionHistory([]);
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

    if (!vaultPubkey) return;

    try {
      setLoadingVault(true);
      const data = await fetchVaultData(vaultPubkey);
      setVaultData(data);
    } catch (error) {
      setVaultData(null);
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
  // AUTO-REFRESH EFFECTS
  // ============================================================

  // Auto-refresh balance every 10 seconds when wallet exists
  useEffect(() => {
    if (!wallet) {
      // Reset balances when no wallet
      resetBalances();
      return;
    }

    // Fetch balance immediately
    fetchBalance();

    // Set up interval to fetch every 10 seconds
    const interval = setInterval(() => {
      fetchBalance();
    }, 10000);

    // Cleanup interval on unmount or when wallet changes
    return () => clearInterval(interval);
  }, [wallet, fetchBalance, resetBalances]);

  // Auto-refresh transaction history every 30 seconds when wallet exists
  useEffect(() => {
    if (!wallet) {
      resetTransactionHistory();
      return;
    }

    // Fetch transaction history immediately
    fetchTransactionHistory();

    // Set up interval to fetch every 30 seconds
    const interval = setInterval(() => {
      fetchTransactionHistory();
    }, 30000);

    // Cleanup interval on unmount or when wallet changes
    return () => clearInterval(interval);
  }, [wallet, fetchTransactionHistory, resetTransactionHistory]);

  // Auto-refresh vault data every 10 seconds when wallet exists
  useEffect(() => {
    if (!wallet) {
      resetVaultData();
      return;
    }

    // Fetch vault data immediately
    fetchVault();

    // Set up interval to fetch every 10 seconds
    const interval = setInterval(() => {
      fetchVault();
    }, 10000);

    // Cleanup interval on unmount or when wallet changes
    return () => clearInterval(interval);
  }, [wallet, fetchVault, resetVaultData]);

  // ============================================================
  // CONSOLIDATED VALUE
  // ============================================================
  const value = {
    // Balance namespace
    balance: {
      segwitBalance,
      taprootBalance,
      runesBalance,
      loadingBalance,
      refreshing,
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
      fetchTransactionHistory,
      resetTransactionHistory,
    },
    // Vault data namespace
    vault: {
      vaultData,
      loadingVault,
      fetchVault,
      resetVaultData,
    },
    // Direct exports for backwards compatibility
    segwitBalance,
    taprootBalance,
    runesBalance,
    loadingBalance,
    refreshing,
    utxos,
    loadingUtxos,
    fetchBalance,
    onRefresh,
    fetchUtxos,
    resetBalances,
    transactionHistory,
    loadingTransactionHistory,
    fetchTransactionHistory,
    resetTransactionHistory,
    vaultData,
    loadingVault,
    fetchVault,
    resetVaultData,
  };

  return <WalletDataContext.Provider value={value}>{children}</WalletDataContext.Provider>;
};
