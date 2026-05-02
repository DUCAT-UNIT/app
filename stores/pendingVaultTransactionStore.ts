/**
 * Pending Vault Transaction Store (Zustand)
 * Tracks pending vault transactions that are waiting for block confirmation
 * Used to show pending state in activity list and disable action buttons
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { logger } from '../utils/logger';
import type { VaultHistoryTransaction } from '../services/vaultService';
import {
  mapVaultActionToJournalKind,
  operationJournalId,
  useOperationJournalStore,
} from './operationJournalStore';

export type VaultAction = 'open' | 'borrow' | 'repay' | 'deposit' | 'withdraw' | 'repo';

export interface PendingVaultTransaction {
  txid: string;
  vaultTxid?: string;
  action: VaultAction;
  btcAmt: number;
  unitAmt: number;
  timestamp: number;
  vaultPubkey: string;
}

interface PendingVaultTransactionState {
  pendingTransaction: PendingVaultTransaction | null;
  currentAccount: number;
}

interface PendingVaultTransactionActions {
  setPendingTransaction: (tx: PendingVaultTransaction) => Promise<void>;
  clearPendingTransaction: () => Promise<void>;
  hasPendingTransaction: () => boolean;
  getPendingAsHistoryTransaction: () => VaultHistoryTransaction | null;
  loadFromStorage: (accountIndex: number) => Promise<void>;
}

type PendingVaultTransactionStore = PendingVaultTransactionState & PendingVaultTransactionActions;

const STORAGE_KEY_PREFIX = 'pending_vault_tx_';

const getStorageKey = (accountIndex: number): string => {
  return `${STORAGE_KEY_PREFIX}${accountIndex}`;
};

const initialState: PendingVaultTransactionState = {
  pendingTransaction: null,
  currentAccount: 0,
};

function vaultJournalTxid(tx: PendingVaultTransaction): string {
  return tx.vaultTxid || tx.txid;
}

function vaultJournalLabel(action: VaultAction): string {
  switch (action) {
    case 'open':
      return 'Vault open submitted';
    case 'borrow':
      return 'Vault borrow submitted';
    case 'repay':
      return 'Vault repay submitted';
    case 'deposit':
      return 'Vault deposit submitted';
    case 'withdraw':
      return 'Vault withdraw submitted';
    default:
      return 'Vault liquidation submitted';
  }
}

function recordPendingVaultJournal(accountIndex: number, tx: PendingVaultTransaction): void {
  const txid = vaultJournalTxid(tx);
  useOperationJournalStore.getState().recordOperation({
    id: operationJournalId('vault', accountIndex, txid),
    accountIndex,
    kind: mapVaultActionToJournalKind(tx.action),
    stage: 'pending',
    label: vaultJournalLabel(tx.action),
    idempotencyKey: `vault:${accountIndex}:${tx.action}:${txid}`,
    retrySafety: 'unsafe_until_checked',
    txids: tx.vaultTxid ? [tx.txid, tx.vaultTxid] : [tx.txid],
    asset: tx.unitAmt > 0 ? 'UNIT' : 'BTC',
    amount: tx.unitAmt > 0 ? String(tx.unitAmt) : String(tx.btcAmt),
    recipient: tx.vaultPubkey,
    recoveryAction: 'Wait for vault confirmation before submitting another vault operation.',
    createdAt: tx.timestamp,
    updatedAt: tx.timestamp,
  });
}

function markPendingVaultConfirmed(accountIndex: number, tx: PendingVaultTransaction): void {
  const txid = vaultJournalTxid(tx);
  useOperationJournalStore.getState().markConfirmed(
    operationJournalId('vault', accountIndex, txid),
    txid,
  );
}

export const usePendingVaultTransactionStore = create<PendingVaultTransactionStore>((set, get) => ({
  ...initialState,

  loadFromStorage: async (accountIndex: number) => {
    const { currentAccount: prevAccount } = get();

    if (accountIndex === prevAccount && get().pendingTransaction !== null) {
      return;
    }

    set({
      pendingTransaction: null,
      currentAccount: accountIndex,
    });

    try {
      const stored = await SecureStore.getItemAsync(getStorageKey(accountIndex));
      if (stored) {
        const tx = JSON.parse(stored) as PendingVaultTransaction;
        // Check if transaction is older than 1 hour - if so, clear it
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        if (tx.timestamp > oneHourAgo) {
          set({ pendingTransaction: tx });
          recordPendingVaultJournal(accountIndex, tx);
          logger.info('[PendingVaultTx] Loaded pending vault transaction', {
            txid: tx.txid.slice(0, 16) + '...',
            action: tx.action,
          });
        } else {
          // Clear stale transaction
          await SecureStore.deleteItemAsync(getStorageKey(accountIndex));
          logger.info('[PendingVaultTx] Cleared stale pending vault transaction');
        }
      }
    } catch (error) {
      logger.error('[PendingVaultTx] Error loading from storage:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  setPendingTransaction: async (tx: PendingVaultTransaction) => {
    const { currentAccount } = get();

    logger.info('[PendingVaultTx] Setting pending vault transaction', {
      txid: tx.txid.slice(0, 16) + '...',
      action: tx.action,
      btcAmt: tx.btcAmt,
      unitAmt: tx.unitAmt,
    });

    set({ pendingTransaction: tx });
    recordPendingVaultJournal(currentAccount, tx);

    try {
      await SecureStore.setItemAsync(getStorageKey(currentAccount), JSON.stringify(tx));
    } catch (error) {
      logger.error('[PendingVaultTx] Error saving to storage:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  clearPendingTransaction: async () => {
    const { currentAccount, pendingTransaction } = get();

    if (pendingTransaction) {
      logger.info('[PendingVaultTx] Clearing pending vault transaction', {
        txid: pendingTransaction.txid.slice(0, 16) + '...',
        action: pendingTransaction.action,
      });
    }

    set({ pendingTransaction: null });
    if (pendingTransaction) {
      markPendingVaultConfirmed(currentAccount, pendingTransaction);
    }

    try {
      await SecureStore.deleteItemAsync(getStorageKey(currentAccount));
    } catch (error) {
      logger.error('[PendingVaultTx] Error clearing from storage:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  hasPendingTransaction: () => {
    return get().pendingTransaction !== null;
  },

  getPendingAsHistoryTransaction: () => {
    const { pendingTransaction } = get();
    if (!pendingTransaction) return null;

    // Convert to VaultHistoryTransaction format for display
    return {
      amount_borrowed: 0,
      vault_amount: 0,
      btc_amt: pendingTransaction.btcAmt,
      unit_amt: pendingTransaction.unitAmt,
      oracle_price: 0,
      timestamp: Math.floor(pendingTransaction.timestamp / 1000), // Convert to seconds
      action: pendingTransaction.action,
      transaction_id: pendingTransaction.txid,
      isPending: true, // Flag to indicate pending status
    } as VaultHistoryTransaction & { isPending: boolean };
  },
}));

// Selector hooks
export const usePendingVaultTx = () =>
  usePendingVaultTransactionStore((state) => state.pendingTransaction);

export const useHasPendingVaultTx = () =>
  usePendingVaultTransactionStore((state) => state.pendingTransaction !== null);

// Reset store (for testing)
export const resetPendingVaultTransactionStore = () => {
  usePendingVaultTransactionStore.setState(initialState);
};
