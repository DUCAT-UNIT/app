/**
 * useTransactionHistoryFetch Hook
 * Manages transaction history state and fetching logic
 * Extracted from WalletDataContext for better separation of concerns
 * Note: Different from useTransactionHistoryData which is for UI consumption
 */

import { useState, useCallback } from 'react';
import { fetchAllTransactionHistory } from '../services/transactionHistoryService';

export function useTransactionHistoryFetch(wallet) {
  // Transaction history state
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [loadingTransactionHistory, setLoadingTransactionHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);

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
      setHistoryError(null);
      const history = await fetchAllTransactionHistory(segwitAddress, taprootAddress, vaultPubkey);
      setTransactionHistory(history);
    } catch (error) {
      setHistoryError('Failed to fetch transaction history');
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

  return {
    // State
    transactionHistory,
    loadingTransactionHistory,
    historyError,
    // Functions
    fetchTransactionHistory,
    resetTransactionHistory,
  };
}
