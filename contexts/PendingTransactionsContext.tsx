/**
 * PendingTransactionsContext - Thin wrapper around pendingTransactionsStore
 * The actual state lives in stores/pendingTransactionsStore.ts (Zustand)
 *
 * This provider handles:
 * - Loading from storage when currentAccount changes
 * - Providing showSnackbar to the invalidateTransaction action
 * - Backwards-compatible usePendingTransactions() hook
 *
 * For better performance, use the selector hooks directly:
 * - usePendingTxs() - only re-renders on transaction changes
 * - useSpentUtxos() - only re-renders on spent UTXO changes
 */

import React, { useEffect, useContext, ReactNode, useCallback, useMemo } from 'react';
import {
  usePendingTransactionsStore,
  usePendingTxs,
  useSpentUtxos,
} from '../stores/pendingTransactionsStore';
import type { SnackbarParams } from '../types/notification';
import type {
  UnconfirmedBalance,
  AddressType,
  TransactionIntent,
  UnconfirmedUTXO,
} from '../utils/pendingTransactionsUtils';
import type { UtxoRef } from '../types/assets';

// Re-export types and selectors from store
export type {
  PendingTransaction,
  PendingTransactionOutput,
} from '../stores/pendingTransactionsStore';
export { usePendingTxs, useSpentUtxos } from '../stores/pendingTransactionsStore';
export type { UtxoRef } from '../types/assets';

export interface UnconfirmedUTXOExport {
  txid: string;
  vout: number;
  value: number;
  runeAmount?: number;
  address: string;
}

interface PendingTransactionsContextValue {
  pendingTransactions: Record<string, import('../stores/pendingTransactionsStore').PendingTransaction>;
  addPendingTransaction: (
    txid: string,
    outputs: import('../stores/pendingTransactionsStore').PendingTransactionOutput[],
    assetType: 'BTC' | 'UNIT',
    parentTxid?: string | null,
    sentAmount?: number,
    inputUtxos?: Array<{ txid: string; vout: number }>
  ) => Promise<void>;
  confirmTransaction: (txid: string) => Promise<void>;
  invalidateTransaction: (txid: string, reason?: string) => Promise<string[]>;
  getUnconfirmedUTXOs: (addressType?: AddressType, excludeFromIntent?: TransactionIntent | null) => UnconfirmedUTXO[];
  getUnconfirmedBalance: (addressType?: AddressType) => UnconfirmedBalance;
  markUtxoAsSpent: (txid: string, vout: number) => Promise<void>;
  cleanupInvalidTransactions: () => Promise<void>;
  markUtxosAsSpent: (utxos: UtxoRef[]) => Promise<void>;
  unmarkUtxosAsSpent: (utxos: UtxoRef[]) => Promise<void>;
  isUtxoSpent: (txid: string, vout: number) => boolean;
  getSpentUtxos: () => Set<string>;
}

const ShowSnackbarContext = React.createContext<((params: SnackbarParams) => void) | null>(null);

/**
 * Legacy hook - returns all pending transactions values
 * For better performance, use selector hooks: usePendingTxs, useSpentUtxos
 */
export const usePendingTransactions = (): PendingTransactionsContextValue => {
  const showSnackbar = useContext(ShowSnackbarContext);
  const pendingTransactions = usePendingTxs();
  const store = usePendingTransactionsStore();

  // Wrap invalidateTransaction to inject showSnackbar
  const invalidateTransaction = useCallback(
    async (txid: string, reason = 'Parent transaction failed'): Promise<string[]> => {
      if (!showSnackbar) {
        throw new Error('usePendingTransactions must be used within a PendingTransactionsProvider');
      }
      return store.invalidateTransaction(txid, reason, showSnackbar);
    },
    [store, showSnackbar]
  );

  return useMemo(() => ({
    pendingTransactions,
    addPendingTransaction: store.addPendingTransaction,
    confirmTransaction: store.confirmTransaction,
    invalidateTransaction,
    getUnconfirmedUTXOs: store.getUnconfirmedUTXOs,
    getUnconfirmedBalance: store.getUnconfirmedBalance,
    markUtxoAsSpent: store.markUtxoAsSpent,
    cleanupInvalidTransactions: store.cleanupInvalidTransactions,
    markUtxosAsSpent: store.markUtxosAsSpent,
    unmarkUtxosAsSpent: store.unmarkUtxosAsSpent,
    isUtxoSpent: store.isUtxoSpent,
    getSpentUtxos: store.getSpentUtxos,
  }), [pendingTransactions, store, invalidateTransaction]);
};

interface PendingTransactionsProviderProps {
  children: ReactNode;
  currentAccount: number;
  showSnackbar: (params: SnackbarParams) => void;
}

/**
 * PendingTransactionsProvider - Handles storage loading on account change
 * The actual state management is done by Zustand store
 */
export const PendingTransactionsProvider: React.FC<PendingTransactionsProviderProps> = ({
  children,
  currentAccount,
  showSnackbar,
}) => {
  const loadFromStorage = usePendingTransactionsStore((state) => state.loadFromStorage);

  // Load from storage when account changes
  useEffect(() => {
    if (currentAccount !== undefined && currentAccount !== null) {
      loadFromStorage(currentAccount);
    }
  }, [currentAccount, loadFromStorage]);

  return (
    <ShowSnackbarContext.Provider value={showSnackbar}>
      {children}
    </ShowSnackbarContext.Provider>
  );
};
