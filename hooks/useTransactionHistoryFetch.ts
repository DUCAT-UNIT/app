/**
 * useTransactionHistoryFetch Hook
 * Manages transaction history state and fetching logic
 * Extracted from WalletDataContext for better separation of concerns
 * Note: Different from useTransactionHistoryData which is for UI consumption
 */

import { useCallback,useMemo,useRef,useState } from 'react';
import type { WalletAddresses } from '../contexts/WalletContext';
import { fetchAllTransactionHistory,Transaction } from '../services/transactionHistoryService';

export interface UseTransactionHistoryFetchReturn {
  transactionHistory: Transaction[];
  loadingTransactionHistory: boolean;
  historyError: string | null;
  fetchTransactionHistory: () => Promise<void>;
  resetTransactionHistory: () => void;
}

export function useTransactionHistoryFetch(wallet: WalletAddresses | null): UseTransactionHistoryFetchReturn {
  // Transaction history state
  const [transactionHistory, setTransactionHistory] = useState<Transaction[]>([]);
  const [loadingTransactionHistory, setLoadingTransactionHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Keep a ref to previous transaction hash for comparison
  const prevHashRef = useRef<string>('');
  // Track whether we've ever loaded data (to avoid setting loading=false when already false)
  const hasLoadedOnceRef = useRef(false);

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
      // Only show loading spinner on first fetch (no cached data yet)
      if (!hasLoadedOnceRef.current) {
        setLoadingTransactionHistory(true);
      }
      const history = await fetchAllTransactionHistory(segwitAddress, taprootAddress, vaultPubkey);

      // Update state if transactions have changed
      // Compute hash once (no sort - order matters for display)
      // Include txid, confirmation status, and block height to detect when pending txs confirm
      const newHash = history
        .map(t => `${t.txid}:${t.status?.confirmed || false}:${t.status?.block_height || 0}`)
        .join('|');

      if (newHash !== prevHashRef.current) {
        prevHashRef.current = newHash;
        setTransactionHistory(history);
      }

      // Only update loading state if it was true (first fetch)
      if (!hasLoadedOnceRef.current) {
        hasLoadedOnceRef.current = true;
        setLoadingTransactionHistory(false);
      }
    } catch (error: unknown) {
      setHistoryError('Failed to fetch transaction history');
      if (!hasLoadedOnceRef.current) {
        hasLoadedOnceRef.current = true;
        setLoadingTransactionHistory(false);
      }
    }
  }, [wallet]);

  /**
   * Reset transaction history (called when wallet is reset)
   */
  const resetTransactionHistory = useCallback(() => {
    setTransactionHistory([]);
    hasLoadedOnceRef.current = false;
    prevHashRef.current = '';
  }, []);

  // Memoize return value to prevent context consumers from re-rendering
  // when nothing has actually changed
  return useMemo(() => ({
    transactionHistory,
    loadingTransactionHistory,
    historyError,
    fetchTransactionHistory,
    resetTransactionHistory,
  }), [transactionHistory, loadingTransactionHistory, historyError, fetchTransactionHistory, resetTransactionHistory]);
}
