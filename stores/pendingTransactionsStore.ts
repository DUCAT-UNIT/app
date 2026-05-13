/**
 * Pending Transactions Store (Zustand)
 * Tracks unconfirmed transactions for chaining
 * Allows spending unconfirmed change outputs to improve UX
 *
 * MIGRATION: Replaces PendingTransactionsContext
 * Benefits: No provider needed, selective re-renders, simpler state management
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { logger } from '../utils/logger';
import { DEVICE_ONLY } from '../services/storagePolicy';
import {
  buildExclusionSet,
  getUnconfirmedUTXOsFromPending,
  calculateUnconfirmedBalance,
  invalidateTransactionTree,
  removeUtxoFromPending,
  cleanupInvalidTransactions as cleanupInvalid,
  markUtxosAsSpent as markSpent,
  unmarkUtxosAsSpent as unmarkSpent,
  getPendingInputUtxoKeys,
} from '../utils/pendingTransactionsUtils';
import type {
  UnconfirmedBalance,
  AddressType,
  TransactionIntent,
  UnconfirmedUTXO,
  PendingTransaction as UtilsPendingTransaction,
} from '../utils/pendingTransactionsUtils';

import type { UtxoRef } from '../types/assets';
import { operationJournalId, useOperationJournalStore } from './operationJournalStore';
import type { TransactionDisplayKind } from '../utils/transactionMerging';

export type PendingTransactionDisplayKind = TransactionDisplayKind;

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
  displayKind?: PendingTransactionDisplayKind;
}

interface PendingTransactionsState {
  pendingTransactions: Record<string, PendingTransaction>;
  spentUtxos: Set<string>;
  currentAccount: number;
  hydratedAccount: number | null;
}

interface PendingTransactionsActions {
  // Core actions
  addPendingTransaction: (
    txid: string,
    outputs: PendingTransactionOutput[],
    assetType: 'BTC' | 'UNIT',
    parentTxid?: string | null,
    sentAmount?: number,
    inputUtxos?: Array<{ txid: string; vout: number }>,
    options?: {
      displayKind?: PendingTransactionDisplayKind;
    }
  ) => Promise<void>;
  confirmTransaction: (txid: string) => Promise<void>;
  invalidateTransaction: (txid: string, reason?: string) => Promise<string[]>;

  // UTXO getters
  getUnconfirmedUTXOs: (
    addressType?: AddressType,
    excludeFromIntent?: TransactionIntent | null
  ) => UnconfirmedUTXO[];
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
  hydratedAccount: null,
};

function sendJournalScope(
  transaction: Pick<PendingTransaction, 'assetType' | 'displayKind'>
): string {
  if (transaction.displayKind === 'turbo_mint_claim') {
    return 'turbounit-claim';
  }
  if (transaction.displayKind === 'turbo_redeem') {
    return transaction.assetType === 'BTC' ? 'turbobtc-redeem' : 'turbounit-redeem';
  }
  return transaction.assetType === 'UNIT' ? 'unit-send' : 'btc-send';
}

function sendJournalLabel(
  transaction: Pick<PendingTransaction, 'assetType' | 'displayKind'>
): string {
  if (transaction.displayKind === 'turbo_mint_claim') {
    return 'TurboUNIT claim submitted';
  }
  if (transaction.displayKind === 'turbo_redeem') {
    return transaction.assetType === 'BTC' ? 'TurboBTC redeem submitted' : 'TurboUNIT redeem submitted';
  }
  return transaction.assetType === 'UNIT' ? 'UNIT send submitted' : 'BTC send submitted';
}

function sendJournalKind(assetType: 'BTC' | 'UNIT'): 'btc_send' | 'unit_send' {
  return assetType === 'UNIT' ? 'unit_send' : 'btc_send';
}

function recordPendingSendJournal(accountIndex: number, transaction: PendingTransaction): void {
  const now = transaction.timestamp || Date.now();
  const id = operationJournalId(sendJournalScope(transaction), accountIndex, transaction.txid);

  useOperationJournalStore.getState().recordOperation({
    id,
    accountIndex,
    kind: sendJournalKind(transaction.assetType),
    stage: 'pending',
    label: sendJournalLabel(transaction),
    idempotencyKey: `${sendJournalScope(transaction)}:${accountIndex}:${transaction.txid}`,
    retrySafety: 'unsafe_until_checked',
    txids: [transaction.txid],
    asset: transaction.assetType,
    amount: transaction.sentAmount === undefined ? null : String(transaction.sentAmount),
    recipient: transaction.outputs[0]?.address ?? null,
    recoveryAction: 'Wait for Mutinynet confirmation before spending the same funds again.',
    createdAt: now,
    updatedAt: now,
  });
}

function markPendingSendConfirmed(accountIndex: number, transaction: PendingTransaction): void {
  useOperationJournalStore
    .getState()
    .markConfirmed(
      operationJournalId(sendJournalScope(transaction), accountIndex, transaction.txid),
      transaction.txid
    );
}

function markPendingSendFailed(
  accountIndex: number,
  transaction: PendingTransaction,
  reason: string
): void {
  useOperationJournalStore
    .getState()
    .markFailed(
      operationJournalId(sendJournalScope(transaction), accountIndex, transaction.txid),
      reason
    );
}

// Storage helpers
const getStorageKey = (accountIndex: number, type: 'txs' | 'spent'): string => {
  return type === 'txs' ? `pending_txs_${accountIndex}` : `spent_utxos_${accountIndex}`;
};

const savePendingTransactions = async (
  txs: Record<string, PendingTransaction>,
  accountIndex: number
): Promise<void> => {
  try {
    await SecureStore.setItemAsync(
      getStorageKey(accountIndex, 'txs'),
      JSON.stringify(txs),
      DEVICE_ONLY
    );
  } catch (error: unknown) {
    logger.error('Error saving pending transactions:', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

const saveSpentUtxos = async (spent: Set<string>, accountIndex: number): Promise<void> => {
  try {
    await SecureStore.setItemAsync(
      getStorageKey(accountIndex, 'spent'),
      JSON.stringify(Array.from(spent)),
      DEVICE_ONLY
    );
  } catch (error: unknown) {
    logger.error('Error saving spent UTXOs:', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

const quarantineCorruptPendingStorage = async (
  storageKey: string,
  stored: string,
  reason: string
): Promise<void> => {
  const quarantineKey = `${storageKey}_corrupt_${Date.now()}`;
  try {
    await SecureStore.setItemAsync(quarantineKey, stored, DEVICE_ONLY);
    logger.warn('[PendingTransactionsStore] Quarantined corrupt pending storage', {
      storageKey,
      quarantineKey,
      reason,
    });
  } catch (error) {
    logger.error('[PendingTransactionsStore] Failed to quarantine corrupt pending storage', {
      storageKey,
      reason,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const parsePendingTransactionsStorage = async (
  storageKey: string,
  stored: string
): Promise<Record<string, PendingTransaction>> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    await quarantineCorruptPendingStorage(storageKey, stored, 'invalid JSON');
    throw new Error(`Pending transactions storage corrupted: ${storageKey}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    await quarantineCorruptPendingStorage(storageKey, stored, 'invalid transaction map');
    throw new Error(`Pending transactions storage corrupted: ${storageKey}`);
  }

  return parsed as Record<string, PendingTransaction>;
};

const parseSpentUtxosStorage = async (
  storageKey: string,
  stored: string
): Promise<Set<string>> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    await quarantineCorruptPendingStorage(storageKey, stored, 'invalid JSON');
    throw new Error(`Spent UTXO storage corrupted: ${storageKey}`);
  }

  if (!Array.isArray(parsed)) {
    await quarantineCorruptPendingStorage(storageKey, stored, 'invalid spent UTXO list');
    throw new Error(`Spent UTXO storage corrupted: ${storageKey}`);
  }

  return new Set(parsed.filter((item): item is string => typeof item === 'string'));
};

const ensureAccountHydratedForMutation = async (
  getState: () => PendingTransactionsStore,
  accountIndex: number
): Promise<void> => {
  if (getState().hydratedAccount === accountIndex) {
    return;
  }

  await getState().loadFromStorage(accountIndex);

  if (getState().hydratedAccount !== accountIndex) {
    throw new Error(
      `Pending transaction storage for account ${accountIndex} is not hydrated; refusing to mutate pending locks.`
    );
  }
};

export const usePendingTransactionsStore = create<PendingTransactionsStore>((set, get) => ({
  // Initial state
  ...initialState,

  // Load from storage for a specific account
  loadFromStorage: async (accountIndex: number) => {
    const { currentAccount: prevAccount, pendingTransactions: prevTxs, hydratedAccount } = get();
    const prevTxCount = Object.keys(prevTxs).length;

    logger.info('[loadFromStorage] Called with:', {
      newAccount: accountIndex,
      prevAccount,
      prevPendingTxCount: prevTxCount,
      hydratedAccount,
    });

    // Only skip once this account has actually been hydrated from storage.
    if (accountIndex === prevAccount && hydratedAccount === accountIndex) {
      logger.info('[loadFromStorage] Same account already hydrated, skipping reset');
      return;
    }

    // Reset state immediately to prevent stale data
    set({
      pendingTransactions: {},
      spentUtxos: new Set(),
      currentAccount: accountIndex,
      hydratedAccount: null,
    });

    logger.info('[PendingTransactionsStore] Loading data for account', {
      currentAccount: accountIndex,
    });

    let pendingTransactions: Record<string, PendingTransaction> = {};
    let spentUtxos = new Set<string>();

    try {
      const txsKey = getStorageKey(accountIndex, 'txs');
      const stored = await SecureStore.getItemAsync(txsKey);
      if (stored) {
        pendingTransactions = await parsePendingTransactionsStorage(txsKey, stored);
      }
    } catch (error: unknown) {
      logger.error('Error loading pending transactions:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    try {
      const spentKey = getStorageKey(accountIndex, 'spent');
      const stored = await SecureStore.getItemAsync(spentKey);
      if (stored) {
        spentUtxos = await parseSpentUtxosStorage(spentKey, stored);
      }
    } catch (error: unknown) {
      logger.error('Error loading spent UTXOs:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    getPendingInputUtxoKeys(pendingTransactions as Record<string, UtilsPendingTransaction>)
      .forEach((key) => spentUtxos.add(key));

    set({
      pendingTransactions,
      spentUtxos,
      hydratedAccount: accountIndex,
    });
    Object.values(pendingTransactions).forEach((transaction) => {
      if (transaction.status === 'pending') {
        recordPendingSendJournal(accountIndex, transaction);
      }
    });
  },

  // Add a new pending transaction
  addPendingTransaction: async (
    txid,
    outputs,
    assetType,
    parentTxid = null,
    sentAmount,
    inputUtxos,
    options
  ) => {
    let { pendingTransactions, spentUtxos, currentAccount } = get();
    await ensureAccountHydratedForMutation(get, currentAccount);
    ({ pendingTransactions, spentUtxos, currentAccount } = get());

    logger.info('[addPendingTransaction] Adding pending tx:', {
      txid: txid.slice(0, 16) + '...',
      outputCount: outputs.length,
      outputs: outputs.map((o) => ({
        address: o.address?.slice(0, 15) + '...',
        value: o.value,
        vout: o.vout,
      })),
      assetType,
      parentTxid: parentTxid?.slice(0, 16),
      currentAccount,
      sentAmount,
      inputUtxoCount: inputUtxos?.length || 0,
      displayKind: options?.displayKind,
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
      displayKind: options?.displayKind,
    };

    let updatedPendingTransactions =
      pendingTransactions as Record<string, UtilsPendingTransaction>;

    inputUtxos?.forEach(({ txid: inputTxid, vout }) => {
      updatedPendingTransactions = removeUtxoFromPending(
        updatedPendingTransactions,
        inputTxid,
        vout
      );
    });

    const updated = {
      ...updatedPendingTransactions,
      [txid]: newTx,
    } as Record<string, PendingTransaction>;
    const updatedSpentUtxos = inputUtxos?.length ? markSpent(spentUtxos, inputUtxos) : spentUtxos;

    set({
      pendingTransactions: updated,
      spentUtxos: updatedSpentUtxos,
    });
    await savePendingTransactions(updated, currentAccount);
    if (inputUtxos?.length) {
      await saveSpentUtxos(updatedSpentUtxos, currentAccount);
    }
    recordPendingSendJournal(currentAccount, newTx);

    logger.info('[addPendingTransaction] Pending transactions after add:', {
      totalCount: Object.keys(updated).length,
    });
  },

  // Confirm transaction and remove from pending
  confirmTransaction: async (txid) => {
    let { pendingTransactions, spentUtxos, currentAccount } = get();
    await ensureAccountHydratedForMutation(get, currentAccount);
    ({ pendingTransactions, spentUtxos, currentAccount } = get());

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
      logger.warn('[confirmTransaction] No inputUtxos tracked for tx', {
        txid: txid.slice(0, 16) + '...',
      });
    }

    set({
      pendingTransactions: updated,
      spentUtxos: updatedSpentUtxos,
    });

    await saveSpentUtxos(updatedSpentUtxos, currentAccount);
    await savePendingTransactions(updated, currentAccount);
    if (confirmedTx) {
      markPendingSendConfirmed(currentAccount, confirmedTx);
    }
  },

  // Invalidate transaction and all children
  invalidateTransaction: async (txid, reason = 'Parent transaction failed') => {
    let { pendingTransactions, spentUtxos, currentAccount } = get();
    await ensureAccountHydratedForMutation(get, currentAccount);
    ({ pendingTransactions, spentUtxos, currentAccount } = get());

    const { updated, invalidated } = invalidateTransactionTree(
      pendingTransactions as Record<string, UtilsPendingTransaction>,
      txid
    );

    const updatedSpentUtxos = new Set(spentUtxos);
    invalidated.forEach((invalidatedTxid) => {
      pendingTransactions[invalidatedTxid]?.inputUtxos?.forEach(({ txid: inputTxid, vout }) => {
        updatedSpentUtxos.delete(`${inputTxid}:${vout}`);
      });
    });

    set({
      pendingTransactions: updated as Record<string, PendingTransaction>,
      spentUtxos: updatedSpentUtxos,
    });
    await saveSpentUtxos(updatedSpentUtxos, currentAccount);
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
      const action = transaction?.assetType === 'UNIT' ? 'swap' : 'btc_send';

      // Get showSnackbar from notification store (avoids Context dependency)
      const { useNotificationStore } = require('./notificationStore');
      useNotificationStore.getState().showSnackbar({
        type: 'error',
        action,
        message,
      });

      invalidated.forEach((invalidatedTxid) => {
        const invalidatedTx = pendingTransactions[invalidatedTxid];
        if (invalidatedTx) {
          markPendingSendFailed(currentAccount, invalidatedTx, reason);
        }
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
    logger.debug('[getUnconfirmedUTXOs] Excluded keys:', {
      count: excludedKeys.size,
      keys: Array.from(excludedKeys).slice(0, 3),
    });
    logger.debug('[getUnconfirmedUTXOs] Spent UTXOs:', {
      count: spentUtxos.size,
      keys: Array.from(spentUtxos).slice(0, 3),
    });

    // Log each pending transaction
    Object.entries(pendingTransactions).forEach(([txid, tx]) => {
      logger.debug('[getUnconfirmedUTXOs] Pending tx:', {
        txid: txid.slice(0, 16) + '...',
        status: tx.status,
        outputCount: tx.outputs?.length || 0,
        outputs: tx.outputs?.map((o) => ({
          address: o.address?.slice(0, 10) + '...',
          value: o.value,
          vout: o.vout,
        })),
      });
    });

    const result = getUnconfirmedUTXOsFromPending(
      pendingTransactions as Record<string, UtilsPendingTransaction>,
      addressType,
      excludedKeys,
      spentUtxos
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
    let { pendingTransactions, currentAccount } = get();
    await ensureAccountHydratedForMutation(get, currentAccount);
    ({ pendingTransactions, currentAccount } = get());

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
    let { spentUtxos, currentAccount } = get();
    await ensureAccountHydratedForMutation(get, currentAccount);
    ({ spentUtxos, currentAccount } = get());
    const updated = markSpent(spentUtxos, utxos);
    set({ spentUtxos: updated });
    await saveSpentUtxos(updated, currentAccount);
  },

  // Unmark UTXOs as spent
  unmarkUtxosAsSpent: async (utxos) => {
    let { spentUtxos, currentAccount } = get();
    await ensureAccountHydratedForMutation(get, currentAccount);
    ({ spentUtxos, currentAccount } = get());
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
    let { pendingTransactions, currentAccount } = get();
    await ensureAccountHydratedForMutation(get, currentAccount);
    ({ pendingTransactions, currentAccount } = get());

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

/**
 * Reset store to initial state (useful for testing)
 */
export const resetPendingTransactionsStore = () => {
  usePendingTransactionsStore.setState(initialState);
};
