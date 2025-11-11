import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchAllTransactionHistory } from '../services/transactionHistoryService';
import { useWallet } from './WalletContext';

const TransactionHistoryContext = createContext();

export const useTransactionHistory = () => {
  const context = useContext(TransactionHistoryContext);
  if (!context) {
    throw new Error('useTransactionHistory must be used within a TransactionHistoryProvider');
  }
  return context;
};

export const TransactionHistoryProvider = ({ children }) => {
  const { wallet } = useWallet();

  // Transaction history state
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [loadingTransactionHistory, setLoadingTransactionHistory] = useState(false);

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

  const value = {
    // State
    transactionHistory,
    loadingTransactionHistory,

    // Functions
    fetchTransactionHistory,
    resetTransactionHistory,
  };

  return (
    <TransactionHistoryContext.Provider value={value}>
      {children}
    </TransactionHistoryContext.Provider>
  );
};
