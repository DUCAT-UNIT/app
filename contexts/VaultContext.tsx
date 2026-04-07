/**
 * VaultContext - Manages vault data and transaction confirmation
 * Extracted from WalletDataContext for single-responsibility
 */

import React, { createContext, ReactNode, useContext, useEffect } from 'react';
import { useVaultDataFetch, UseVaultDataFetchReturn } from '../hooks/useVaultDataFetch';
import { useNotificationStore } from '../stores/notificationStore';
import { usePendingVaultTransactionStore } from '../stores/pendingVaultTransactionStore';
import { useSendFlowStore } from '../stores/sendFlowStore';
import { logger } from '../utils/logger';
import { useWallet } from './WalletContext';

export type VaultDataValue = UseVaultDataFetchReturn;

const VaultCtx = createContext<VaultDataValue | undefined>(undefined);

export const useVaultData = (): VaultDataValue => {
  const context = useContext(VaultCtx);
  if (!context) {
    throw new Error('useVaultData must be used within a VaultProvider');
  }
  return context;
};

interface VaultProviderProps {
  children: ReactNode;
}

export const VaultProvider: React.FC<VaultProviderProps> = ({ children }) => {
  const { wallet } = useWallet();

  const vault = useVaultDataFetch(wallet);

  // ============================================================
  // VAULT TRANSACTION CONFIRMATION CHECK
  // ============================================================
  const pendingVaultTx = usePendingVaultTransactionStore((state) => state.pendingTransaction);

  useEffect(() => {
    if (pendingVaultTx && vault.vaultTransactions.length > 0) {
      logger.debug('[VaultContext] Checking vault tx confirmation', {
        pendingTxid: pendingVaultTx.txid,
        pendingVaultTxid: pendingVaultTx.vaultTxid,
        pendingAction: pendingVaultTx.action,
        historyCount: vault.vaultTransactions.length,
        historyTxIds: vault.vaultTransactions.slice(0, 5).map(tx => tx.transaction_id),
      });

      const isConfirmed = vault.vaultTransactions.some(
        tx => tx.transaction_id === pendingVaultTx.txid ||
              tx.transaction_id === pendingVaultTx.vaultTxid
      );

      logger.debug('[VaultContext] Confirmation check result', { isConfirmed });

      if (isConfirmed) {
        const confirmedAction = pendingVaultTx.action;
        const confirmedTxid = pendingVaultTx.vaultTxid || pendingVaultTx.txid;
        logger.info('[VaultContext] Vault transaction confirmed', { action: confirmedAction, txid: confirmedTxid });
        usePendingVaultTransactionStore.getState().clearPendingTransaction();
        const currentSnackbar = useNotificationStore.getState().snackbar;
        const intentStep = useSendFlowStore.getState().intentStep;
        if (!currentSnackbar && intentStep === 'idle') {
          useNotificationStore.getState().showSnackbar({
            type: 'success',
            action: confirmedAction,
            txid: confirmedTxid,
          });
        } else {
          logger.debug('[VaultContext] Skipping vault confirmation snackbar', { hasSnackbar: !!currentSnackbar, intentStep });
        }
      }
    }
  }, [pendingVaultTx, vault.vaultTransactions]);

  return <VaultCtx.Provider value={vault}>{children}</VaultCtx.Provider>;
};
