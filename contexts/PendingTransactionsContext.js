/**
 * PendingTransactionsContext - Tracks unconfirmed transactions for chaining
 * Allows spending unconfirmed change outputs to improve UX
 * Handles parent-child transaction relationships and invalidation
 */

import React, { createContext, useContext, useCallback } from 'react';
import { usePendingTransactionsStorage } from '../hooks/usePendingTransactionsStorage';

const PendingTransactionsContext = createContext();

export const usePendingTransactions = () => {
  const context = useContext(PendingTransactionsContext);
  if (!context) {
    throw new Error('usePendingTransactions must be used within a PendingTransactionsProvider');
  }
  return context;
};

export const PendingTransactionsProvider = ({ children, currentAccount, showToast }) => {
  // Use storage hook for persistence
  const {
    pendingTransactions,
    setPendingTransactions,
    savePendingTransactions,
    spentUtxos,
    setSpentUtxos,
    saveSpentUtxos,
  } = usePendingTransactionsStorage(currentAccount);

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
   * Also clean up spent UTXOs that were inputs to this transaction
   */
  const confirmTransaction = useCallback(async (txid) => {
    const updated = { ...pendingTransactions };
    delete updated[txid];

    setPendingTransactions(updated);
    await savePendingTransactions(updated);

    // Clean up spent UTXOs - when a transaction confirms, its inputs are truly spent on-chain
    // We can remove them from our tracking set
    const updatedSpent = new Set(spentUtxos);
    // Keep the spent set for now - we'll clean it up periodically
    // Actually, we should keep them to prevent reuse until they're confirmed
  }, [pendingTransactions, spentUtxos, currentAccount]);

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
   * @param {string} addressType - Filter by address type ('all', 'segwit', 'taproot')
   * @param {object} excludeFromIntent - Optional intent object whose inputs should be excluded
   */
  const getUnconfirmedUTXOs = useCallback((addressType = 'all', excludeFromIntent = null) => {
    const utxos = [];

    // Build a set of UTXOs to exclude (from the active intent)
    const excludedKeys = new Set();
    if (excludeFromIntent) {
      // Exclude BTC inputs
      if (excludeFromIntent.inputs) {
        excludeFromIntent.inputs.forEach(input => {
          const key = `${input.txid}:${input.vout}`;
          excludedKeys.add(key);
        });
      }
      // Exclude UNIT inputs (runeUtxo and satUtxo)
      if (excludeFromIntent.runeUtxo) {
        const key = `${excludeFromIntent.runeUtxo.transaction}:${excludeFromIntent.runeUtxo.vout}`;
        excludedKeys.add(key);
      }
      if (excludeFromIntent.satUtxo) {
        const key = `${excludeFromIntent.satUtxo.txid}:${excludeFromIntent.satUtxo.vout}`;
        excludedKeys.add(key);
      }
    }

    Object.values(pendingTransactions).forEach(tx => {
      // Only include pending transactions (not invalid)
      if (tx.status === 'pending') {
        tx.outputs.forEach(output => {
          // Check if this UTXO should be excluded
          const key = `${tx.txid}:${output.vout}`;
          if (excludedKeys.has(key)) {
            return; // Skip this UTXO
          }

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
   * Mark a UTXO as spent by removing it from pending transaction outputs
   * This prevents it from being selected again when creating new transactions
   */
  const markUtxoAsSpent = useCallback(async (txid, vout) => {
    const updated = { ...pendingTransactions };

    if (updated[txid] && updated[txid].outputs) {
      // Remove the specific output from the transaction's outputs
      updated[txid].outputs = updated[txid].outputs.filter(output => output.vout !== vout);

      // If no outputs left, remove the transaction entirely
      if (updated[txid].outputs.length === 0) {
        delete updated[txid];
      }

      setPendingTransactions(updated);
      await savePendingTransactions(updated);
    }
  }, [pendingTransactions, currentAccount]);

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

  /**
   * Mark UTXOs as spent to prevent reuse
   * @param {Array} utxos - Array of {txid, vout} objects
   */
  const markUtxosAsSpent = useCallback(async (utxos) => {
    const updated = new Set(spentUtxos);

    utxos.forEach(({ txid, vout }) => {
      const key = `${txid}:${vout}`;
      updated.add(key);
      console.log('🚫 Marking UTXO as spent:', key);
    });

    setSpentUtxos(updated);
    await saveSpentUtxos(updated);
  }, [spentUtxos, currentAccount]);

  /**
   * Check if a UTXO is spent
   * @param {string} txid - Transaction ID
   * @param {number} vout - Output index
   * @returns {boolean} True if the UTXO is spent
   */
  const isUtxoSpent = useCallback((txid, vout) => {
    const key = `${txid}:${vout}`;
    return spentUtxos.has(key);
  }, [spentUtxos]);

  /**
   * Get all spent UTXO keys
   * @returns {Set} Set of spent UTXO keys (txid:vout)
   */
  const getSpentUtxos = useCallback(() => {
    return spentUtxos;
  }, [spentUtxos]);

  const value = {
    pendingTransactions,
    addPendingTransaction,
    confirmTransaction,
    invalidateTransaction,
    getUnconfirmedUTXOs,
    getUnconfirmedBalance,
    markUtxoAsSpent,
    cleanupInvalidTransactions,
    markUtxosAsSpent,
    isUtxoSpent,
    getSpentUtxos,
  };

  return (
    <PendingTransactionsContext.Provider value={value}>
      {children}
    </PendingTransactionsContext.Provider>
  );
};
