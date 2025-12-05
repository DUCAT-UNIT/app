/**
 * Pending Vault Transaction Store (Zustand)
 * Tracks pending vault transactions that are waiting for block confirmation
 * Used to show pending state in activity list and disable action buttons
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import type { VaultHistoryTransaction } from '../services/vaultService';

export type VaultAction = 'open' | 'borrow' | 'repay' | 'deposit' | 'withdraw';

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
      const stored = await AsyncStorage.getItem(getStorageKey(accountIndex));
      if (stored) {
        const tx = JSON.parse(stored) as PendingVaultTransaction;
        // Check if transaction is older than 1 hour - if so, clear it
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        if (tx.timestamp > oneHourAgo) {
          set({ pendingTransaction: tx });
          logger.info('[PendingVaultTx] Loaded pending vault transaction', {
            txid: tx.txid.slice(0, 16) + '...',
            action: tx.action,
          });
        } else {
          // Clear stale transaction
          await AsyncStorage.removeItem(getStorageKey(accountIndex));
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

    try {
      await AsyncStorage.setItem(getStorageKey(currentAccount), JSON.stringify(tx));
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

    try {
      await AsyncStorage.removeItem(getStorageKey(currentAccount));
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
