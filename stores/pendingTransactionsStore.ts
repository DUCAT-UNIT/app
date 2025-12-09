/**
 * Pending Transactions Store (Zustand)
 * Tracks unconfirmed transactions for chaining
 * Allows spending unconfirmed change outputs to improve UX
 *
 * MIGRATION: Replaces PendingTransactionsContext
 * Benefits: No provider needed, selective re-renders, simpler state management
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
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
import type {
  UnconfirmedBalance,
  AddressType,
  TransactionIntent,
  UnconfirmedUTXO,
  PendingTransaction as UtilsPendingTransaction,
} from '../utils/pendingTransactionsUtils';
import type { SnackbarParams } from '../types/notification';
import type { UtxoRef } from '../types/assets';

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
  sentAmount?: number; // Amount sent in the transaction (sats for BTC, smallest units for UNIT)
  inputUtxos?: Array<{ txid: string; vout: number }>; // Track which UTXOs were spent by this transaction
}

interface PendingTransactionsState {
  pendingTransactions: Record<string, PendingTransaction>;
  spentUtxos: Set<string>;
  currentAccount: number;
}

interface PendingTransactionsActions {
  // Core actions
  addPendingTransaction: (
    txid: string,
    outputs: PendingTransactionOutput[],
    assetType: 'BTC' | 'UNIT',
    parentTxid?: string | null,
    sentAmount?: number,
    inputUtxos?: Array<{ txid: string; vout: number }>
  ) => Promise<void>;
  confirmTransaction: (txid: string) => Promise<void>;
  invalidateTransaction: (
    txid: string,
    reason: string,
    showSnackbar: (params: SnackbarParams) => void
  ) => Promise<string[]>;

  // UTXO getters
  getUnconfirmedUTXOs: (addressType?: AddressType, excludeFromIntent?: TransactionIntent | null) => UnconfirmedUTXO[];
  getUnconfirmedBalance: (addressType?: AddressType) => UnconfirmedBalance;

  // UTXO management
  markUtxoAsSpent: (txid: string, vout: number) => Promise<void>;
  markUtxosAsSpent: (utxos: UtxoRef[]) => Promise<void>;
  unmarkUtxosAsSpent: (utxos: UtxoRef[]) => Promise<void>;
  isUtxoSpent: (txid: string, vout: number) => boolean;
  getSpentUtxos: () => Set<string>;

  // Maintenance
  cleanupInvalidTransactions: () => Promise<void>;
  loadFromStorage: (accountIndex: number) => Promise<void>;
}

type PendingTransactionsStore = PendingTransactionsState & PendingTransactionsActions;

const initialState: PendingTransactionsState = {
  pendingTransactions: {},
  spentUtxos: new Set(),
  currentAccount: 0,
};

// Storage helpers
const getStorageKey = (accountIndex: number, type: 'txs' | 'spent'): string => {
  return type === 'txs' ? `pending_txs_${accountIndex}` : `spent_utxos_${accountIndex}`;
};

const savePendingTransactions = async (
  txs: Record<string, PendingTransaction>,
  accountIndex: number
): Promise<void> => {
  try {
    await AsyncStorage.setItem(getStorageKey(accountIndex, 'txs'), JSON.stringify(txs));
  } catch (error: unknown) {
    logger.error('Error saving pending transactions:', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const saveSpentUtxos = async (spent: Set<string>, accountIndex: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(getStorageKey(accountIndex, 'spent'), JSON.stringify(Array.from(spent)));
  } catch (error: unknown) {
    logger.error('Error saving spent UTXOs:', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const usePendingTransactionsStore = create<PendingTransactionsStore>((set, get) => ({
  // Initial state
  ...initialState,

  // Load from storage for a specific account
  loadFromStorage: async (accountIndex: number) => {
    const { currentAccount: prevAccount, pendingTransactions: prevTxs } = get();
    const prevTxCount = Object.keys(prevTxs).length;

    logger.info('[loadFromStorage] Called with:', {
      newAccount: accountIndex,
      prevAccount,
      prevPendingTxCount: prevTxCount,
    });

    // Only reset if account actually changed
    if (accountIndex === prevAccount) {
      logger.info('[loadFromStorage] Same account, skipping reset');
      return;
    }

    // Reset state immediately to prevent stale data
    set({
      pendingTransactions: {},
      spentUtxos: new Set(),
      currentAccount: accountIndex,
    });

    logger.info('[PendingTransactionsStore] Loading data for account', { currentAccount: accountIndex });

    try {
      const txsKey = getStorageKey(accountIndex, 'txs');
      const stored = await AsyncStorage.getItem(txsKey);
      if (stored) {
        set({ pendingTransactions: JSON.parse(stored) });
      }
    } catch (error: unknown) {
      logger.error('Error loading pending transactions:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      const spentKey = getStorageKey(accountIndex, 'spent');
      const stored = await AsyncStorage.getItem(spentKey);
      if (stored) {
        set({ spentUtxos: new Set(JSON.parse(stored)) });
      }
    } catch (error: unknown) {
      logger.error('Error loading spent UTXOs:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  // Add a new pending transaction
  addPendingTransaction: async (txid, outputs, assetType, parentTxid = null, sentAmount, inputUtxos) => {
    const { pendingTransactions, currentAccount } = get();

    logger.info('[addPendingTransaction] Adding pending tx:', {
      txid: txid.slice(0, 16) + '...',
      outputCount: outputs.length,
      outputs: outputs.map(o => ({ address: o.address?.slice(0, 15) + '...', value: o.value, vout: o.vout })),
      assetType,
      parentTxid: parentTxid?.slice(0, 16),
      currentAccount,
      sentAmount,
      inputUtxoCount: inputUtxos?.length || 0,
    });

    const newTx: PendingTransaction = {
      txid,
      outputs,
      parentTxid,
      assetType,
      status: 'pending',
      timestamp: Date.now(),
      sentAmount,
      inputUtxos,
    };

    const updated = {
      ...pendingTransactions,
      [txid]: newTx,
    };

    set({ pendingTransactions: updated });
    await savePendingTransactions(updated, currentAccount);

    logger.info('[addPendingTransaction] Pending transactions after add:', {
      totalCount: Object.keys(updated).length,
    });
  },

  // Confirm transaction and remove from pending
  confirmTransaction: async (txid) => {
    const { pendingTransactions, spentUtxos, currentAccount } = get();

    const confirmedTx = pendingTransactions[txid];
    const updated: Record<string, PendingTransaction> = { ...pendingTransactions };
    delete updated[txid];

    // Only clear spent UTXOs that were inputs to this confirmed transaction
    // Keep spent UTXOs from other pending transactions intact
    const updatedSpentUtxos = new Set(spentUtxos);

    if (confirmedTx?.inputUtxos) {
      logger.info('[confirmTransaction] Clearing spent UTXOs for confirmed tx:', {
        txid: txid.slice(0, 16) + '...',
        inputCount: confirmedTx.inputUtxos.length,
      });

      confirmedTx.inputUtxos.forEach(({ txid: inputTxid, vout }) => {
        const key = `${inputTxid}:${vout}`;
        updatedSpentUtxos.delete(key);
        logger.debug('[confirmTransaction] Cleared UTXO:', key);
      });
    } else {
      logger.warn('[confirmTransaction] No inputUtxos tracked for tx', { txid: txid.slice(0, 16) + '...' });
    }

    set({
      pendingTransactions: updated,
      spentUtxos: updatedSpentUtxos,
    });

    await savePendingTransactions(updated, currentAccount);
    await saveSpentUtxos(updatedSpentUtxos, currentAccount);
  },

  // Invalidate transaction and all children
  invalidateTransaction: async (txid, reason = 'Parent transaction failed', showSnackbar) => {
    const { pendingTransactions, currentAccount } = get();

    const { updated, invalidated } = invalidateTransactionTree(
      pendingTransactions as Record<string, UtilsPendingTransaction>,
      txid
    );

    set({ pendingTransactions: updated as Record<string, PendingTransaction> });
    await savePendingTransactions(updated as Record<string, PendingTransaction>, currentAccount);

    // Show warning if any transactions were invalidated
    if (invalidated.length > 0) {
      const count = invalidated.length;
      const message =
        count === 1
          ? `1 transaction has been invalidated: ${reason}`
          : `${count} transactions have been invalidated: ${reason}`;

      // Determine action based on asset type
      const transaction = pendingTransactions[txid];
      const action = transaction?.assetType === 'UNIT' ? 'swap' : 'withdraw';

      showSnackbar({
        type: 'error',
        action,
        message,
      });
    }

    return invalidated;
  },

  // Get unconfirmed UTXOs
  getUnconfirmedUTXOs: (addressType = 'all', excludeFromIntent = null) => {
    const { pendingTransactions, spentUtxos } = get();
    const excludedKeys = buildExclusionSet(excludeFromIntent);

    // Debug logging
    const txCount = Object.keys(pendingTransactions).length;
    logger.debug('[getUnconfirmedUTXOs] Pending transactions count:', { count: txCount });
    logger.debug('[getUnconfirmedUTXOs] Address type filter:', { addressType });
    logger.debug('[getUnconfirmedUTXOs] Excluded keys:', { count: excludedKeys.size, keys: Array.from(excludedKeys).slice(0, 3) });
    logger.debug('[getUnconfirmedUTXOs] Spent UTXOs:', { count: spentUtxos.size, keys: Array.from(spentUtxos).slice(0, 3) });

    // Log each pending transaction
    Object.entries(pendingTransactions).forEach(([txid, tx]) => {
      logger.debug('[getUnconfirmedUTXOs] Pending tx:', {
        txid: txid.slice(0, 16) + '...',
        status: tx.status,
        outputCount: tx.outputs?.length || 0,
        outputs: tx.outputs?.map(o => ({ address: o.address?.slice(0, 10) + '...', value: o.value, vout: o.vout })),
      });
    });

    const result = getUnconfirmedUTXOsFromPending(
      pendingTransactions as Record<string, UtilsPendingTransaction>,
      addressType,
      excludedKeys
    );

    logger.debug('[getUnconfirmedUTXOs] Returning UTXOs:', { count: result.length });
    return result;
  },

  // Get unconfirmed balance
  getUnconfirmedBalance: (addressType = 'all') => {
    const utxos = get().getUnconfirmedUTXOs(addressType);
    return calculateUnconfirmedBalance(utxos);
  },

  // Mark single UTXO as spent
  markUtxoAsSpent: async (txid, vout) => {
    const { pendingTransactions, currentAccount } = get();

    const updated = removeUtxoFromPending(
      pendingTransactions as Record<string, UtilsPendingTransaction>,
      txid,
      vout
    );

    set({ pendingTransactions: updated as Record<string, PendingTransaction> });
    await savePendingTransactions(updated as Record<string, PendingTransaction>, currentAccount);
  },

  // Mark multiple UTXOs as spent
  markUtxosAsSpent: async (utxos) => {
    const { spentUtxos, currentAccount } = get();
    const updated = markSpent(spentUtxos, utxos);
    set({ spentUtxos: updated });
    await saveSpentUtxos(updated, currentAccount);
  },

  // Unmark UTXOs as spent
  unmarkUtxosAsSpent: async (utxos) => {
    const { spentUtxos, currentAccount } = get();
    const updated = unmarkSpent(spentUtxos, utxos);
    set({ spentUtxos: updated });
    await saveSpentUtxos(updated, currentAccount);
  },

  // Check if UTXO is spent
  isUtxoSpent: (txid, vout) => {
    const key = `${txid}:${vout}`;
    return get().spentUtxos.has(key);
  },

  // Get all spent UTXO keys
  getSpentUtxos: () => {
    return get().spentUtxos;
  },

  // Cleanup invalid transactions
  cleanupInvalidTransactions: async () => {
    const { pendingTransactions, currentAccount } = get();

    const { updated, cleaned } = cleanupInvalid(
      pendingTransactions as Record<string, UtilsPendingTransaction>
    );

    if (cleaned > 0) {
      set({ pendingTransactions: updated as Record<string, PendingTransaction> });
      await savePendingTransactions(updated as Record<string, PendingTransaction>, currentAccount);
    }
  },
}));

/**
 * Selector hooks for granular subscriptions
 */
export const usePendingTxs = () =>
  usePendingTransactionsStore((state) => state.pendingTransactions);
export const useSpentUtxos = () =>
  usePendingTransactionsStore((state) => state.spentUtxos);

/**
 * Reset store to initial state (useful for testing)
 */
export const resetPendingTransactionsStore = () => {
  usePendingTransactionsStore.setState(initialState);
};
