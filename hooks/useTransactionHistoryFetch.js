/**
 * useTransactionHistoryFetch Hook
 * Manages transaction history state and fetching logic
 * Extracted from WalletDataContext for better separation of concerns
 * Note: Different from useTransactionHistoryData which is for UI consumption
 */

import { useState, useCallback, useRef } from 'react';
import { fetchAllTransactionHistory } from '../services/transactionHistoryService';

/**
 * Deep equality check for transaction arrays
 * Uses Set-based comparison to avoid order issues
 */
function areTransactionsEqual(prev, next) {
  if (!prev || !next) return false;
  if (prev.length !== next.length) return false;

  // Create a map of txid -> tx data for quick lookup
  const prevMap = new Map();
  prev.forEach(tx => {
    prevMap.set(tx.txid, {
      confirmed: tx.status?.confirmed,
      block_height: tx.status?.block_height
    });
  });

  // Check if all transactions in next exist in prev with same status
  for (const tx of next) {
    const prevTx = prevMap.get(tx.txid);
    if (!prevTx) return false; // New transaction

    if (prevTx.confirmed !== tx.status?.confirmed) return false;
    if (prevTx.block_height !== tx.status?.block_height) return false;
  }

  return true;
}

export function useTransactionHistoryFetch(wallet) {
  // Transaction history state
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [loadingTransactionHistory, setLoadingTransactionHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  // Keep a ref to previous transaction history for comparison
  const prevHistoryRef = useRef([]);

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
      // Only show loading spinner if we have no cached data
      if (prevHistoryRef.current.length === 0) {
        setLoadingTransactionHistory(true);
      }
      setHistoryError(null);
      const history = await fetchAllTransactionHistory(segwitAddress, taprootAddress, vaultPubkey);

      // Only update state if transactions have actually changed
      const prevTxids = prevHistoryRef.current.map(t => t.txid).sort().join(',');
      const newTxids = history.map(t => t.txid).sort().join(',');
      const hasChanged = prevTxids !== newTxids;

      if (hasChanged) {
        console.log('[TxHistoryFetch] UPDATING STATE - transactions changed');
        prevHistoryRef.current = history;
        setTransactionHistory(history);
      } else {
        console.log('[TxHistoryFetch] SKIPPING UPDATE - transactions unchanged');
      }
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
