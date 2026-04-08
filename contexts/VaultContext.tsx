/**
 * VaultContext - Manages vault data and transaction confirmation
 * Extracted from WalletDataContext for single-responsibility
 */

import React, { createContext, ReactNode, useContext, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useVaultDataFetch, UseVaultDataFetchReturn } from '../hooks/useVaultDataFetch';
import { useNotificationStore } from '../stores/notificationStore';
import { usePendingVaultTransactionStore } from '../stores/pendingVaultTransactionStore';
import { useSendFlowStore } from '../stores/sendFlowStore';
import { sendLocalNotification } from '../services/pushNotificationService';
import { getNotificationsEnabled } from '../services/settingsService';
import { isE2E } from '../utils/e2e';
import { logger } from '../utils/logger';
import { useWallet } from './WalletContext';

const VAULT_HEALTH_ALERT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const VAULT_HEALTH_WARNING_KEY = 'vault_health_warning_last_alert';
const VAULT_HEALTH_CRITICAL_KEY = 'vault_health_critical_last_alert';

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

  // ============================================================
  // VAULT HEALTH ALERTS (local notifications)
  // ============================================================
  const lastHealthAlertRef = useRef<{ warning: number; critical: number }>({
    warning: 0,
    critical: 0,
  });

  const checkVaultHealthAlert = useCallback(async (healthPercent: number): Promise<void> => {
    if (isE2E) return;

    try {
      const enabled = await getNotificationsEnabled();
      if (!enabled) return;

      const now = Date.now();

      // Load last alert timestamps from storage (first check only)
      if (lastHealthAlertRef.current.warning === 0 && lastHealthAlertRef.current.critical === 0) {
        const [warningTs, criticalTs] = await Promise.all([
          AsyncStorage.getItem(VAULT_HEALTH_WARNING_KEY),
          AsyncStorage.getItem(VAULT_HEALTH_CRITICAL_KEY),
        ]);
        lastHealthAlertRef.current.warning = warningTs ? parseInt(warningTs, 10) : 0;
        lastHealthAlertRef.current.critical = criticalTs ? parseInt(criticalTs, 10) : 0;
      }

      if (healthPercent <= 170) {
        // Critical alert
        if (now - lastHealthAlertRef.current.critical >= VAULT_HEALTH_ALERT_INTERVAL_MS) {
          await sendLocalNotification({
            title: 'Vault at Risk!',
            body: `Your vault health is ${healthPercent.toFixed(0)}% - dangerously close to liquidation.`,
            data: { type: 'vault_health' },
          });
          lastHealthAlertRef.current.critical = now;
          await AsyncStorage.setItem(VAULT_HEALTH_CRITICAL_KEY, String(now));
          logger.info('[VaultContext] Sent critical vault health alert', { healthPercent });
        }
      } else if (healthPercent < 200 && healthPercent > 170) {
        // Warning alert
        if (now - lastHealthAlertRef.current.warning >= VAULT_HEALTH_ALERT_INTERVAL_MS) {
          await sendLocalNotification({
            title: 'Vault Health Alert',
            body: `Your vault health is ${healthPercent.toFixed(0)}% - consider adding collateral.`,
            data: { type: 'vault_health' },
          });
          lastHealthAlertRef.current.warning = now;
          await AsyncStorage.setItem(VAULT_HEALTH_WARNING_KEY, String(now));
          logger.info('[VaultContext] Sent warning vault health alert', { healthPercent });
        }
      }
    } catch (error: unknown) {
      logger.error('[VaultContext] Failed to check vault health alert', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  useEffect(() => {
    const vaultInfo = vault.vaultData?.vaultInfo;
    if (!vaultInfo) return;

    // collateral_ratio from the API is a multiplier (e.g. 1.6 for 160%)
    // Convert to percentage for display and threshold checks
    const rawRatio = vaultInfo.collateral_ratio;
    const healthPercent = rawRatio < 10 ? rawRatio * 100 : rawRatio;
    if (typeof healthPercent === 'number' && healthPercent > 0) {
      void checkVaultHealthAlert(healthPercent);
    }
  }, [vault.vaultData, checkVaultHealthAlert]);

  return <VaultCtx.Provider value={vault}>{children}</VaultCtx.Provider>;
};
