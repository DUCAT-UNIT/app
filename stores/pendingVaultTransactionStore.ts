/**
 * Pending Vault Transaction Store (Zustand)
 * Tracks pending vault transactions that are waiting for block confirmation
 * Used to show pending state in activity list and disable action buttons
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { logger } from '../utils/logger';
import type { VaultHistoryTransaction } from '../services/vaultService';
import { DEVICE_ONLY } from '../services/storagePolicy';
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
  hydratedAccount: number | null;
  storageLoadError: string | null;
}

interface PendingVaultTransactionActions {
  setPendingTransaction: (tx: PendingVaultTransaction) => Promise<void>;
  setPendingTransactionForAccount: (
    tx: PendingVaultTransaction,
    accountIndex: number
  ) => Promise<void>;
  clearPendingTransaction: () => Promise<void>;
  clearPendingTransactionForAccount: (accountIndex: number) => Promise<void>;
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
  hydratedAccount: null,
  storageLoadError: null,
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

const quarantineCorruptPendingVaultStorage = async (
  storageKey: string,
  stored: string,
  reason: string
): Promise<void> => {
  const quarantineKey = `${storageKey}_corrupt_${Date.now()}`;
  try {
    await SecureStore.setItemAsync(quarantineKey, stored, DEVICE_ONLY);
    logger.warn('[PendingVaultTx] Quarantined corrupt pending vault transaction storage', {
      storageKey,
      quarantineKey,
      reason,
    });
  } catch (error) {
    logger.error('[PendingVaultTx] Failed to quarantine corrupt pending vault transaction storage', {
      storageKey,
      reason,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const parsePendingVaultTransaction = async (
  storageKey: string,
  stored: string
): Promise<PendingVaultTransaction> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    await quarantineCorruptPendingVaultStorage(storageKey, stored, 'invalid JSON');
    throw new Error(`Pending vault transaction storage corrupted: ${storageKey}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    await quarantineCorruptPendingVaultStorage(storageKey, stored, 'invalid transaction');
    throw new Error(`Pending vault transaction storage corrupted: ${storageKey}`);
  }

  const tx = parsed as Partial<PendingVaultTransaction>;
  if (
    typeof tx.txid !== 'string' ||
    typeof tx.action !== 'string' ||
    typeof tx.timestamp !== 'number' ||
    typeof tx.vaultPubkey !== 'string'
  ) {
    await quarantineCorruptPendingVaultStorage(storageKey, stored, 'missing required fields');
    throw new Error(`Pending vault transaction storage corrupted: ${storageKey}`);
  }

  return tx as PendingVaultTransaction;
};

const ensureAccountHydratedForVaultMutation = async (
  getState: () => PendingVaultTransactionStore,
  accountIndex: number
): Promise<void> => {
  if (getState().hydratedAccount === accountIndex) {
    return;
  }

  await getState().loadFromStorage(accountIndex);

  if (getState().hydratedAccount !== accountIndex) {
    throw new Error(
      `Pending vault transaction storage for account ${accountIndex} is not hydrated; refusing to mutate pending vault state.`
    );
  }
};

export const usePendingVaultTransactionStore = create<PendingVaultTransactionStore>((set, get) => ({
  ...initialState,

  loadFromStorage: async (accountIndex: number) => {
    const { currentAccount: prevAccount, hydratedAccount } = get();

    if (accountIndex === prevAccount && hydratedAccount === accountIndex) {
      return;
    }

    set({
      pendingTransaction: null,
      currentAccount: accountIndex,
      hydratedAccount: null,
      storageLoadError: null,
    });

    try {
      const storageKey = getStorageKey(accountIndex);
      const stored = await SecureStore.getItemAsync(storageKey);
      if (stored) {
        const tx = await parsePendingVaultTransaction(storageKey, stored);
        set({ pendingTransaction: tx });
        recordPendingVaultJournal(accountIndex, tx);
        logger.info('[PendingVaultTx] Loaded pending vault transaction', {
          txid: tx.txid.slice(0, 16) + '...',
          action: tx.action,
          ageMs: Date.now() - tx.timestamp,
        });
      }
      set({ hydratedAccount: accountIndex });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      set({ storageLoadError: errorMessage });
      logger.error('[PendingVaultTx] Error loading from storage:', {
        error: errorMessage,
      });
    }
  },

  setPendingTransaction: async (tx: PendingVaultTransaction) => {
    const { currentAccount } = get();
    await get().setPendingTransactionForAccount(tx, currentAccount);
  },

  setPendingTransactionForAccount: async (tx: PendingVaultTransaction, accountIndex: number) => {
    await ensureAccountHydratedForVaultMutation(get, accountIndex);
    const { currentAccount } = get();

    if (currentAccount !== accountIndex) {
      throw new Error(
        `Pending vault transaction store switched to account ${currentAccount} while preparing account ${accountIndex}; refusing to persist pending vault state.`
      );
    }

    logger.info('[PendingVaultTx] Setting pending vault transaction', {
      txid: tx.txid.slice(0, 16) + '...',
      action: tx.action,
      btcAmt: tx.btcAmt,
      unitAmt: tx.unitAmt,
    });

    set({ pendingTransaction: tx, storageLoadError: null });
    recordPendingVaultJournal(accountIndex, tx);

    try {
      await SecureStore.setItemAsync(getStorageKey(accountIndex), JSON.stringify(tx), DEVICE_ONLY);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      set({ storageLoadError: errorMessage });
      logger.error('[PendingVaultTx] Error saving to storage:', {
        error: errorMessage,
      });
      throw error;
    }
  },

  clearPendingTransaction: async () => {
    const { currentAccount } = get();
    await get().clearPendingTransactionForAccount(currentAccount);
  },

  clearPendingTransactionForAccount: async (accountIndex: number) => {
    await ensureAccountHydratedForVaultMutation(get, accountIndex);
    const { currentAccount, pendingTransaction } = get();

    if (currentAccount !== accountIndex) {
      throw new Error(
        `Pending vault transaction store switched to account ${currentAccount} while clearing account ${accountIndex}; refusing to clear pending vault state.`
      );
    }

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
      await SecureStore.deleteItemAsync(getStorageKey(accountIndex));
    } catch (error) {
      logger.error('[PendingVaultTx] Error clearing from storage:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  hasPendingTransaction: () => {
    const state = get();
    return state.pendingTransaction !== null || state.storageLoadError !== null;
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
  usePendingVaultTransactionStore(
    (state) => state.pendingTransaction !== null || state.storageLoadError !== null
  );

// Reset store (for testing)
export const resetPendingVaultTransactionStore = () => {
  usePendingVaultTransactionStore.setState(initialState);
};
