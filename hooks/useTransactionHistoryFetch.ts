/**
 * useTransactionHistoryFetch Hook
 * Manages transaction history state and fetching logic
 * Extracted from WalletDataContext for better separation of concerns
 * Note: Different from useTransactionHistoryData which is for UI consumption
 */

import { useCallback,useRef,useState } from 'react';
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
      if (transactionHistory.length === 0) {
        setLoadingTransactionHistory(true);
      }
      setHistoryError(null);
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
    } catch (error: unknown) {
      setHistoryError('Failed to fetch transaction history');
    } finally {
      setLoadingTransactionHistory(false);
    }
  }, [transactionHistory.length, wallet]);

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
