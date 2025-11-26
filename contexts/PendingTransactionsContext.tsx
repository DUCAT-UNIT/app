/**
 * PendingTransactionsContext - Tracks unconfirmed transactions for chaining
 * Allows spending unconfirmed change outputs to improve UX
 * Handles parent-child transaction relationships and invalidation
 */

import React, { createContext, useContext, useCallback, useMemo, ReactNode } from 'react';
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
import type { UnconfirmedBalance, AddressType, TransactionIntent, UnconfirmedUTXO as UtilsUnconfirmedUTXO } from '../utils/pendingTransactionsUtils';
import type { SnackbarParams } from '../types/notification';
import type { UtxoRef } from '../types/assets';

export type { UtxoRef } from '../types/assets';

export interface PendingTransactionOutput {
  address: string;
  value: number;
  vout: number;
  runeAmount?: number;
}

export interface PendingTransaction {
  txid: string;
  outputs: PendingTransactionOutput[];
  parentTxid: string | null;
  assetType: 'BTC' | 'UNIT';
  status: 'pending' | 'invalid';
  timestamp: number;
}

export interface UnconfirmedUTXO {
  txid: string;
  vout: number;
  value: number;
  runeAmount?: number;
  address: string;
}

interface PendingTransactionsContextValue {
  pendingTransactions: Record<string, PendingTransaction>;
  addPendingTransaction: (txid: string, outputs: PendingTransactionOutput[], assetType: 'BTC' | 'UNIT', parentTxid?: string | null) => Promise<void>;
  confirmTransaction: (txid: string) => Promise<void>;
  invalidateTransaction: (txid: string, reason?: string) => Promise<string[]>;
  getUnconfirmedUTXOs: (addressType?: AddressType, excludeFromIntent?: TransactionIntent | null) => UtilsUnconfirmedUTXO[];
  getUnconfirmedBalance: (addressType?: AddressType) => UnconfirmedBalance;
  markUtxoAsSpent: (txid: string, vout: number) => Promise<void>;
  cleanupInvalidTransactions: () => Promise<void>;
  markUtxosAsSpent: (utxos: UtxoRef[]) => Promise<void>;
  unmarkUtxosAsSpent: (utxos: UtxoRef[]) => Promise<void>;
  isUtxoSpent: (txid: string, vout: number) => boolean;
  getSpentUtxos: () => Set<string>;
}

const PendingTransactionsContext = createContext<PendingTransactionsContextValue | undefined>(undefined);

export const usePendingTransactions = (): PendingTransactionsContextValue => {
  const context = useContext(PendingTransactionsContext);
  if (!context) {
    throw new Error('usePendingTransactions must be used within a PendingTransactionsProvider');
  }
  return context;
};

interface PendingTransactionsProviderProps {
  children: ReactNode;
  currentAccount: number;
  showSnackbar: (params: SnackbarParams) => void;
}

export const PendingTransactionsProvider: React.FC<PendingTransactionsProviderProps> = ({
  children,
  currentAccount,
  showSnackbar
}) => {
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
   */
  const addPendingTransaction = useCallback(async (
    txid: string,
    outputs: PendingTransactionOutput[],
    assetType: 'BTC' | 'UNIT',
    parentTxid: string | null = null
  ) => {
    const newTx: PendingTransaction = {
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
  }, [pendingTransactions, setPendingTransactions, savePendingTransactions]);

  /**
   * Mark transaction as confirmed and remove from pending
   * Also clean up spent UTXOs that were inputs to this transaction
   */
  const confirmTransaction = useCallback(async (txid: string) => {
    const updated: Record<string, PendingTransaction> = { ...pendingTransactions };
    delete updated[txid];

    setPendingTransactions(updated);
    await savePendingTransactions(updated);

    // Clear the spent UTXOs set when a transaction confirms
    const clearedSpent = new Set<string>();
    setSpentUtxos(clearedSpent);
    await saveSpentUtxos(clearedSpent);
  }, [pendingTransactions, setPendingTransactions, savePendingTransactions, setSpentUtxos, saveSpentUtxos]);

  /**
   * Invalidate a transaction and all its children
   */
  const invalidateTransaction = useCallback(async (txid: string, reason = 'Parent transaction failed'): Promise<string[]> => {
    const { updated, invalidated } = invalidateTransactionTree(pendingTransactions as Parameters<typeof invalidateTransactionTree>[0], txid);

    setPendingTransactions(updated as Record<string, PendingTransaction>);
    await savePendingTransactions(updated);

    // Show warning if any transactions were invalidated
    if (invalidated.length > 0) {
      const count = invalidated.length;
      const message = count === 1
        ? `1 transaction has been invalidated: ${reason}`
        : `${count} transactions have been invalidated: ${reason}`;

      // Determine action based on asset type of the primary transaction
      const transaction = (pendingTransactions as Record<string, PendingTransaction>)[txid];
      const action = transaction?.assetType === 'UNIT' ? 'swap' : 'withdraw';

      showSnackbar({
        type: 'error',
        action,
        message,
      });
    }

    return invalidated;
  }, [pendingTransactions, setPendingTransactions, savePendingTransactions, showSnackbar]);

  /**
   * Get all unconfirmed UTXOs that can be spent
   */
  const getUnconfirmedUTXOs = useCallback((addressType: AddressType = 'all', excludeFromIntent: TransactionIntent | null = null): UtilsUnconfirmedUTXO[] => {
    const excludedKeys = buildExclusionSet(excludeFromIntent);
    return getUnconfirmedUTXOsFromPending(pendingTransactions as Parameters<typeof getUnconfirmedUTXOsFromPending>[0], addressType, excludedKeys);
  }, [pendingTransactions]);

  /**
   * Get total unconfirmed balance
   */
  const getUnconfirmedBalance = useCallback((addressType: AddressType = 'all'): UnconfirmedBalance => {
    const utxos = getUnconfirmedUTXOs(addressType);
    return calculateUnconfirmedBalance(utxos);
  }, [getUnconfirmedUTXOs]);

  /**
   * Mark a UTXO as spent by removing it from pending transaction outputs
   */
  const markUtxoAsSpent = useCallback(async (txid: string, vout: number) => {
    const updated = removeUtxoFromPending(pendingTransactions as Parameters<typeof removeUtxoFromPending>[0], txid, vout);
    setPendingTransactions(updated as Record<string, PendingTransaction>);
    await savePendingTransactions(updated);
  }, [pendingTransactions, setPendingTransactions, savePendingTransactions]);

  /**
   * Clean up old invalid transactions
   */
  const cleanupInvalidTransactions = useCallback(async () => {
    const { updated, cleaned } = cleanupInvalid(pendingTransactions as Parameters<typeof cleanupInvalid>[0]);

    if (cleaned > 0) {
      setPendingTransactions(updated as Record<string, PendingTransaction>);
      await savePendingTransactions(updated);
    }
  }, [pendingTransactions, setPendingTransactions, savePendingTransactions]);

  /**
   * Mark UTXOs as spent to prevent reuse
   */
  const markUtxosAsSpent = useCallback(async (utxos: UtxoRef[]) => {
    const updated = markSpent(spentUtxos, utxos);
    setSpentUtxos(updated);
    await saveSpentUtxos(updated);
  }, [spentUtxos, setSpentUtxos, saveSpentUtxos]);

  /**
   * Unmark UTXOs as spent (e.g., when canceling a transaction)
   */
  const unmarkUtxosAsSpent = useCallback(async (utxos: UtxoRef[]) => {
    const updated = unmarkSpent(spentUtxos, utxos);
    setSpentUtxos(updated);
    await saveSpentUtxos(updated);
  }, [spentUtxos, setSpentUtxos, saveSpentUtxos]);

  /**
   * Check if a UTXO is spent
   */
  const isUtxoSpent = useCallback((txid: string, vout: number): boolean => {
    const key = `${txid}:${vout}`;
    return spentUtxos.has(key);
  }, [spentUtxos]);

  /**
   * Get all spent UTXO keys
   */
  const getSpentUtxos = useCallback((): Set<string> => {
    return spentUtxos;
  }, [spentUtxos]);

  const value = useMemo(() => ({
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
  }), [
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
  ]);

  return (
    <PendingTransactionsContext.Provider value={value}>
      {children}
    </PendingTransactionsContext.Provider>
  );
};
