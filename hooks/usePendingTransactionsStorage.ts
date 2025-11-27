/**
 * Hook for managing pending transactions storage
 * Handles AsyncStorage persistence for pending transactions and spent UTXOs
 */

import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import type { PendingTransaction } from '../contexts/PendingTransactionsContext';

interface UsePendingTransactionsStorageReturn {
  pendingTransactions: Record<string, PendingTransaction>;
  setPendingTransactions: Dispatch<SetStateAction<Record<string, PendingTransaction>>>;
  savePendingTransactions: (txs: Record<string, unknown>) => Promise<void>;
  spentUtxos: Set<string>;
  setSpentUtxos: Dispatch<SetStateAction<Set<string>>>;
  saveSpentUtxos: (spent: Set<string>) => Promise<void>;
}

export const usePendingTransactionsStorage = (currentAccount: number): UsePendingTransactionsStorageReturn => {
  const [pendingTransactions, setPendingTransactions] = useState<Record<string, PendingTransaction>>({});
  const [spentUtxos, setSpentUtxos] = useState<Set<string>>(new Set());

  // Load pending transactions from storage
  const loadPendingTransactions = useCallback(async () => {
    try {
      const key = `pending_txs_${currentAccount}`;
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        setPendingTransactions(JSON.parse(stored));
      }
    } catch (error: unknown) {
      logger.error('Error loading pending transactions:', { error: error instanceof Error ? error.message : String(error) });
    }
  }, [currentAccount]);

  // Save pending transactions to storage
  const savePendingTransactions = useCallback(async (txs: Record<string, unknown>) => {
    try {
      const key = `pending_txs_${currentAccount}`;
      await AsyncStorage.setItem(key, JSON.stringify(txs));
    } catch (error: unknown) {
      logger.error('Error saving pending transactions:', { error: error instanceof Error ? error.message : String(error) });
    }
  }, [currentAccount]);

  // Load spent UTXOs from storage
  const loadSpentUtxos = useCallback(async () => {
    try {
      const key = `spent_utxos_${currentAccount}`;
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        setSpentUtxos(new Set(JSON.parse(stored)));
      }
    } catch (error: unknown) {
      logger.error('Error loading spent UTXOs:', { error: error instanceof Error ? error.message : String(error) });
    }
  }, [currentAccount]);

  // Save spent UTXOs to storage
  const saveSpentUtxos = useCallback(async (spent: Set<string>) => {
    try {
      const key = `spent_utxos_${currentAccount}`;
      await AsyncStorage.setItem(key, JSON.stringify(Array.from(spent)));
    } catch (error: unknown) {
      logger.error('Error saving spent UTXOs:', { error: error instanceof Error ? error.message : String(error) });
    }
  }, [currentAccount]);

  // Load from storage on mount/account change
  useEffect(() => {
    if (currentAccount !== undefined && currentAccount !== null) {
      // Reset state immediately to prevent showing stale data from previous account
      setPendingTransactions({});
      setSpentUtxos(new Set());

      logger.info('[usePendingTransactionsStorage] Account changed - reloading data for account', { currentAccount });
      loadPendingTransactions();
      loadSpentUtxos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccount]);

  return {
    pendingTransactions,
    setPendingTransactions,
    savePendingTransactions,
    spentUtxos,
    setSpentUtxos,
    saveSpentUtxos,
  };
};
