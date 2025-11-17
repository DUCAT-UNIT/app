/**
 * PendingTransactionsContext - Tracks unconfirmed transactions for chaining
 * Allows spending unconfirmed change outputs to improve UX
 * Handles parent-child transaction relationships and invalidation
 */

import React, { createContext, useContext, useCallback } from 'react';
import { usePendingTransactionsStorage } from '../hooks/usePendingTransactionsStorage';
import {
  buildExclusionSet,
  getUnconfirmedUTXOsFromPending,
  calculateUnconfirmedBalance,
  invalidateTransactionTree,
  removeUtxoFromPending,
  cleanupInvalidTransactions as cleanupInvalid,
  markUtxosAsSpent as markSpent,
  unmarkUtxosAsSpent as unmarkSpent,
} from '../utils/pendingTransactionsUtils';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // CRITICAL: Clear the spent UTXOs set when a transaction confirms
    // Once a transaction confirms on-chain:
    // 1. Its inputs are permanently spent (won't appear in blockchain queries)
    // 2. Its outputs become confirmed UTXOs (will appear in blockchain queries)
    // 3. We no longer need to track which UTXOs are "locked" for pending txs
    //
    // Clearing the set ensures that new confirmed UTXOs can be used immediately.
    // This fixes the "No confirmed funds available" error that occurs when all
    // UTXOs remain marked as spent even after transactions confirm.
    //
    // This is safe because:
    // - Confirmed UTXOs from blockchain are by definition unspent
    // - Pending transaction outputs are tracked separately in pendingTransactions
    // - The blockchain is the source of truth once transactions confirm
    const clearedSpent = new Set();
    setSpentUtxos(clearedSpent);
    await saveSpentUtxos(clearedSpent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTransactions, currentAccount]);

  /**
   * Invalidate a transaction and all its children
   */
  const invalidateTransaction = useCallback(async (txid, reason = 'Parent transaction failed') => {
    const { updated, invalidated } = invalidateTransactionTree(pendingTransactions, txid);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps

  /**
   * Get all unconfirmed UTXOs that can be spent
   * Returns UTXOs from pending (non-invalid) transactions
   * @param {string} addressType - Filter by address type ('all', 'segwit', 'taproot')
   * @param {object} excludeFromIntent - Optional intent object whose inputs should be excluded
   */
  const getUnconfirmedUTXOs = useCallback((addressType = 'all', excludeFromIntent = null) => {
    const excludedKeys = buildExclusionSet(excludeFromIntent);
    return getUnconfirmedUTXOsFromPending(pendingTransactions, addressType, excludedKeys);
  }, [pendingTransactions]);

  /**
   * Get total unconfirmed balance
   */
  const getUnconfirmedBalance = useCallback((addressType = 'all') => {
    const utxos = getUnconfirmedUTXOs(addressType);
    return calculateUnconfirmedBalance(utxos);
  }, [getUnconfirmedUTXOs]);

  /**
   * Mark a UTXO as spent by removing it from pending transaction outputs
   * This prevents it from being selected again when creating new transactions
   */
  const markUtxoAsSpent = useCallback(async (txid, vout) => {
    const updated = removeUtxoFromPending(pendingTransactions, txid, vout);
    setPendingTransactions(updated);
    await savePendingTransactions(updated);
  }, [pendingTransactions, currentAccount]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  /**
   * Clean up old invalid transactions
   */
  const cleanupInvalidTransactions = useCallback(async () => {
    const { updated, cleaned } = cleanupInvalid(pendingTransactions);

    if (cleaned > 0) {
      setPendingTransactions(updated);
      await savePendingTransactions(updated);
    }
  }, [pendingTransactions, currentAccount]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  /**
   * Mark UTXOs as spent to prevent reuse
   * @param {Array} utxos - Array of {txid, vout} objects
   */
  const markUtxosAsSpent = useCallback(async (utxos) => {
    const updated = markSpent(spentUtxos, utxos);
    setSpentUtxos(updated);
    await saveSpentUtxos(updated);
  }, [spentUtxos, currentAccount]);
    // eslint-disable-next-line react-hooks/exhaustive-deps

  /**
   * Unmark UTXOs as spent (e.g., when canceling a transaction)
   * @param {Array} utxos - Array of {txid, vout} objects to release
   */
  const unmarkUtxosAsSpent = useCallback(async (utxos) => {
    const updated = unmarkSpent(spentUtxos, utxos);
    setSpentUtxos(updated);
    await saveSpentUtxos(updated);
  }, [spentUtxos, currentAccount]);
    // eslint-disable-next-line react-hooks/exhaustive-deps

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
    unmarkUtxosAsSpent,
    isUtxoSpent,
    getSpentUtxos,
  };

  return (
    <PendingTransactionsContext.Provider value={value}>
      {children}
    </PendingTransactionsContext.Provider>
  );
};
