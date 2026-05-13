/**
 * useTransactionHistoryFetch Hook
 * Manages transaction history state and fetching logic
 * Extracted from WalletDataContext for better separation of concerns
 * Note: Different from useTransactionHistoryData which is for UI consumption
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { WalletAddresses } from '../contexts/WalletContext';
import { fetchAllTransactionHistory, Transaction } from '../services/transactionHistoryService';
import { usePendingTransactionsStore } from '../stores/pendingTransactionsStore';
import { logger } from '../utils/logger';

const HISTORY_FETCH_STALE_MS = 30_000;

function reconcileConfirmedPendingTransactions(history: Transaction[]): void {
  const confirmedTxids = new Set(history.filter((tx) => tx.status?.confirmed).map((tx) => tx.txid));

  if (confirmedTxids.size === 0) return;

  const { pendingTransactions, confirmTransaction } = usePendingTransactionsStore.getState();
  const pendingTxidsToConfirm = Object.keys(pendingTransactions).filter((txid) =>
    confirmedTxids.has(txid)
  );

  if (pendingTxidsToConfirm.length === 0) return;

  void Promise.all(pendingTxidsToConfirm.map((txid) => confirmTransaction(txid))).catch(
    (error: unknown) => {
      logger.warn('[useTransactionHistoryFetch] Failed to reconcile confirmed pending txs', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  );
}

export interface UseTransactionHistoryFetchReturn {
  transactionHistory: Transaction[];
  loadingTransactionHistory: boolean;
  historyError: string | null;
  fetchTransactionHistory: (
    walletOverride?: Pick<WalletAddresses, 'segwitAddress' | 'taprootAddress' | 'taprootPubkey'>
  ) => Promise<void>;
  resetTransactionHistory: () => void;
}

export function useTransactionHistoryFetch(
  wallet: WalletAddresses | null
): UseTransactionHistoryFetchReturn {
  // Transaction history state
  const [transactionHistory, setTransactionHistory] = useState<Transaction[]>([]);
  const [loadingTransactionHistory, setLoadingTransactionHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Keep a ref to previous transaction hash for comparison
  const prevHashRef = useRef<string>('');
  // Track whether we've ever loaded data (to avoid setting loading=false when already false)
  const hasLoadedOnceRef = useRef(false);
  const historyFetchInFlightRef = useRef(false);
  const historyFetchStartedAtRef = useRef<number | null>(null);
  const historyFetchGenerationRef = useRef(0);

  /**
   * Fetch transaction history in background
   * Fetches from both blockchain addresses and vault API
   */
  const fetchTransactionHistory = useCallback(async (
    walletOverride?: Pick<WalletAddresses, 'segwitAddress' | 'taprootAddress' | 'taprootPubkey'>
  ) => {
    const activeWallet = walletOverride ?? wallet;
    const segwitAddress = activeWallet?.segwitAddress;
    const taprootAddress = activeWallet?.taprootAddress;
    const vaultPubkey = activeWallet?.taprootPubkey;

    if (!segwitAddress || !taprootAddress || !vaultPubkey) return;

    if (historyFetchInFlightRef.current) {
      const startedAt = historyFetchStartedAtRef.current;
      if (!startedAt || Date.now() - startedAt < HISTORY_FETCH_STALE_MS) {
        return;
      }
    }

    const fetchGeneration = historyFetchGenerationRef.current + 1;
    historyFetchGenerationRef.current = fetchGeneration;
    historyFetchInFlightRef.current = true;
    historyFetchStartedAtRef.current = Date.now();

    const isCurrentFetch = () => historyFetchGenerationRef.current === fetchGeneration;

    try {
      // Only show loading spinner on the first load when no cached data exists.
      if (!hasLoadedOnceRef.current) {
        setLoadingTransactionHistory(true);
      }
      // Clear any previous error on new attempt
      setHistoryError(null);
      const history = await fetchAllTransactionHistory(segwitAddress, taprootAddress, vaultPubkey);
      if (!isCurrentFetch()) return;

      reconcileConfirmedPendingTransactions(history);

      // Update state if transactions have changed
      // Compute hash once (no sort - order matters for display)
      // Include txid, confirmation status, and block height to detect when pending txs confirm
      const newHash = history
        .map((t) => `${t.txid}:${t.status?.confirmed || false}:${t.status?.block_height || 0}`)
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
      if (!isCurrentFetch()) return;
      setHistoryError('Failed to fetch transaction history');
      if (!hasLoadedOnceRef.current) {
        hasLoadedOnceRef.current = true;
        setLoadingTransactionHistory(false);
      }
    } finally {
      if (isCurrentFetch()) {
        historyFetchInFlightRef.current = false;
        historyFetchStartedAtRef.current = null;
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
    historyFetchInFlightRef.current = false;
    historyFetchStartedAtRef.current = null;
    historyFetchGenerationRef.current += 1;
    setLoadingTransactionHistory(false);
    setHistoryError(null);
  }, []);

  // Memoize return value to prevent context consumers from re-rendering
  // when nothing has actually changed
  return useMemo(
    () => ({
      transactionHistory,
      loadingTransactionHistory,
      historyError,
      fetchTransactionHistory,
      resetTransactionHistory,
    }),
    [
      transactionHistory,
      loadingTransactionHistory,
      historyError,
      fetchTransactionHistory,
      resetTransactionHistory,
    ]
  );
}
