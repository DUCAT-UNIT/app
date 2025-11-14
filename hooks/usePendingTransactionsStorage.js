/**
 * Hook for managing pending transactions storage
 * Handles AsyncStorage persistence for pending transactions and spent UTXOs
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const usePendingTransactionsStorage = (currentAccount) => {
  const [pendingTransactions, setPendingTransactions] = useState({});
  const [spentUtxos, setSpentUtxos] = useState(new Set());

  // Load pending transactions from storage
  const loadPendingTransactions = useCallback(async () => {
    try {
      const key = `pending_txs_${currentAccount}`;
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        setPendingTransactions(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading pending transactions:', error);
    }
  }, [currentAccount]);

  // Save pending transactions to storage
  const savePendingTransactions = useCallback(async (txs) => {
    try {
      const key = `pending_txs_${currentAccount}`;
      await AsyncStorage.setItem(key, JSON.stringify(txs));
    } catch (error) {
      console.error('Error saving pending transactions:', error);
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
    } catch (error) {
      console.error('Error loading spent UTXOs:', error);
    }
  }, [currentAccount]);

  // Save spent UTXOs to storage
  const saveSpentUtxos = useCallback(async (spent) => {
    try {
      const key = `spent_utxos_${currentAccount}`;
      await AsyncStorage.setItem(key, JSON.stringify(Array.from(spent)));
    } catch (error) {
      console.error('Error saving spent UTXOs:', error);
    }
  }, [currentAccount]);

  // Load from storage on mount/account change
  useEffect(() => {
    if (currentAccount) {
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
