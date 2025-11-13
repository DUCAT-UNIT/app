/**
 * PendingTransactionsContext - Tracks unconfirmed transactions for chaining
 * Allows spending unconfirmed change outputs to improve UX
 * Handles parent-child transaction relationships and invalidation
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PendingTransactionsContext = createContext();

export const usePendingTransactions = () => {
  const context = useContext(PendingTransactionsContext);
  if (!context) {
    throw new Error('usePendingTransactions must be used within a PendingTransactionsProvider');
  }
  return context;
};

export const PendingTransactionsProvider = ({ children, currentAccount, showToast }) => {
  // Format: { txid: { txid, outputs, parentTxid, assetType, status, timestamp } }
  const [pendingTransactions, setPendingTransactions] = useState({});

  // Load pending transactions from storage on mount
  useEffect(() => {
    if (currentAccount) {
      loadPendingTransactions();
    }
  }, [currentAccount]);

  // Load from AsyncStorage
  const loadPendingTransactions = async () => {
    try {
      const key = `pending_txs_${currentAccount}`;
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        setPendingTransactions(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading pending transactions:', error);
    }
  };

  // Save to AsyncStorage
  const savePendingTransactions = async (txs) => {
    try {
      const key = `pending_txs_${currentAccount}`;
      await AsyncStorage.setItem(key, JSON.stringify(txs));
    } catch (error) {
      console.error('Error saving pending transactions:', error);
    }
  };

  /**
   * Add a new pending transaction
   * @param {string} txid - Transaction ID
   * @param {Array} outputs - Array of outputs: [{ address, value, vout, runeAmount? }]
   * @param {string} assetType - 'BTC' or 'UNIT'
   * @param {string} parentTxid - Optional parent transaction ID for chaining
   */
  const addPendingTransaction = useCallback(async (txid, outputs, assetType, parentTxid = null) => {
    const newTx = {
      txid,
      outputs,
      parentTxid,
      assetType,
      status: 'pending',
      timestamp: Date.now(),
    };

    const updated = {
      ...pendingTransactions,
      [txid]: newTx,
    };

    setPendingTransactions(updated);
    await savePendingTransactions(updated);
  }, [pendingTransactions, currentAccount]);

  /**
   * Mark transaction as confirmed and remove from pending
   */
  const confirmTransaction = useCallback(async (txid) => {
    const updated = { ...pendingTransactions };
    delete updated[txid];

    setPendingTransactions(updated);
    await savePendingTransactions(updated);
  }, [pendingTransactions, currentAccount]);

  /**
   * Invalidate a transaction and all its children
   */
  const invalidateTransaction = useCallback(async (txid, reason = 'Parent transaction failed') => {
    const updated = { ...pendingTransactions };
    const invalidated = [];

    // Recursively find and invalidate children
    const invalidateRecursive = (parentId) => {
      Object.keys(updated).forEach(childTxid => {
        if (updated[childTxid].parentTxid === parentId) {
          invalidated.push(childTxid);
          updated[childTxid].status = 'invalid';
          invalidateRecursive(childTxid); // Invalidate grandchildren
        }
      });
    };

    // Mark the transaction itself as invalid
    if (updated[txid]) {
      updated[txid].status = 'invalid';
      invalidated.push(txid);
    }

    // Invalidate all children
    invalidateRecursive(txid);

    setPendingTransactions(updated);
    await savePendingTransactions(updated);

    // Show warning if any transactions were invalidated
    if (invalidated.length > 0) {
      const count = invalidated.length;
      const message = count === 1
        ? `1 transaction has been invalidated: ${reason}`
        : `${count} transactions have been invalidated: ${reason}`;
      showToast(message, 'error');
    }

    return invalidated;
  }, [pendingTransactions, showToast, currentAccount]);

  /**
   * Get all unconfirmed UTXOs that can be spent
   * Returns UTXOs from pending (non-invalid) transactions
   */
  const getUnconfirmedUTXOs = useCallback((addressType = 'all') => {
    const utxos = [];

    Object.values(pendingTransactions).forEach(tx => {
      // Only include pending transactions (not invalid)
      if (tx.status === 'pending') {
        tx.outputs.forEach(output => {
          // Filter by address type if specified
          const isSegwit = output.address.startsWith('tb1q') || output.address.startsWith('bc1q');
          const isTaproot = output.address.startsWith('tb1p') || output.address.startsWith('bc1p');

          const matchesFilter =
            addressType === 'all' ||
            (addressType === 'segwit' && isSegwit) ||
            (addressType === 'taproot' && isTaproot);

          if (matchesFilter) {
            utxos.push({
              ...output,
              txid: tx.txid,
              status: { confirmed: false }, // Match blockchain API format
              parentTxid: tx.parentTxid,
              assetType: tx.assetType,
            });
          }
        });
      }
    });

    return utxos;
  }, [pendingTransactions]);

  /**
   * Get total unconfirmed balance
   */
  const getUnconfirmedBalance = useCallback((addressType = 'all') => {
    const utxos = getUnconfirmedUTXOs(addressType);
    const btcBalance = utxos.reduce((sum, utxo) => sum + (utxo.value || 0), 0);
    const runeBalance = utxos.reduce((sum, utxo) => sum + (utxo.runeAmount || 0), 0);

    return {
      btc: btcBalance / 100000000, // Convert sats to BTC
      runes: runeBalance / 100, // Convert to UNIT
    };
  }, [getUnconfirmedUTXOs]);

  /**
   * Clean up old invalid transactions
   */
  const cleanupInvalidTransactions = useCallback(async () => {
    const updated = { ...pendingTransactions };
    let cleaned = 0;

    Object.keys(updated).forEach(txid => {
      if (updated[txid].status === 'invalid') {
        delete updated[txid];
        cleaned++;
      }
    });

    if (cleaned > 0) {
      setPendingTransactions(updated);
      await savePendingTransactions(updated);
    }
  }, [pendingTransactions, currentAccount]);

  const value = {
    pendingTransactions,
    addPendingTransaction,
    confirmTransaction,
    invalidateTransaction,
    getUnconfirmedUTXOs,
    getUnconfirmedBalance,
    cleanupInvalidTransactions,
  };

  return (
    <PendingTransactionsContext.Provider value={value}>
      {children}
    </PendingTransactionsContext.Provider>
  );
};
