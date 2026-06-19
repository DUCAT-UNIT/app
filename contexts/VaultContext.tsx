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
import { analytics } from '../services/analyticsService';
import { VAULT_EVENTS } from '../constants/analyticsEvents';
import type { PendingVaultTransaction } from '../stores/pendingVaultTransactionStore';
import { getWithRetry } from '../utils/apiClient';
import { getTxApiUrl } from '../utils/constants';
import { isE2E } from '../utils/e2e';
import { logger } from '../utils/logger';
import {
  findSettledHistoryForStalePendingVaultTransaction,
  isPendingVaultTransactionApplied,
} from '../utils/vaultPendingGuard';
import { useAuthSession } from './AuthContext';
import { useWallet } from './WalletContext';

const VAULT_HEALTH_ALERT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const VAULT_HEALTH_WARNING_KEY = 'vault_health_warning_last_alert';
const VAULT_HEALTH_CRITICAL_KEY = 'vault_health_critical_last_alert';
const VAULT_HEALTH_BAND_KEY = 'vault_health_last_band';
const REPO_PENDING_NOT_FOUND_GRACE_MS = 3 * 60 * 1000;

type VaultHealthBand = 'safe' | 'warning' | 'critical';
type TxChainState = 'confirmed' | 'unconfirmed' | 'not_found' | 'unknown';

function getVaultHealthBand(healthPercent: number): VaultHealthBand {
  if (healthPercent <= 170) return 'critical';
  if (healthPercent < 200) return 'warning';
  return 'safe';
}

function isVaultHealthBand(value: string | null): value is VaultHealthBand {
  return value === 'safe' || value === 'warning' || value === 'critical';
}

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

function getPendingVaultConfirmationTxids(tx: PendingVaultTransaction): string[] {
  return Array.from(new Set([tx.txid, tx.vaultTxid].filter(Boolean) as string[]));
}

async function getTxChainState(txid: string): Promise<TxChainState> {
  try {
    const response = await getWithRetry(getTxApiUrl(txid), {
      timeout: 8000,
      retryOptions: { maxRetries: 0 },
      dedupeKey: `vault-pending-confirm:${txid}`,
      circuitKey: 'mutinynet-vault-pending-confirm',
    });
    if (!response.ok) {
      return response.status === 404 ? 'not_found' : 'unknown';
    }
    const tx = await response.json();
    return tx.status?.confirmed ? 'confirmed' : 'unconfirmed';
  } catch (error) {
    logger.warn('[VaultContext] Failed to check pending vault tx chain confirmation', {
      txid,
      error: error instanceof Error ? error.message : String(error),
    });
    return 'unknown';
  }
}

async function getPendingVaultChainStates(tx: PendingVaultTransaction): Promise<TxChainState[]> {
  const txids = getPendingVaultConfirmationTxids(tx);
  if (txids.length === 0) {
    return [];
  }

  return Promise.all(txids.map(getTxChainState));
}

function shouldDiscardMissingRepoPendingTransaction(
  tx: PendingVaultTransaction,
  chainStates: TxChainState[],
): boolean {
  const ageMs = Date.now() - tx.timestamp;

  return (
    (tx.action === 'repo' || tx.action === 'trim') &&
    Number.isFinite(ageMs) &&
    ageMs >= REPO_PENDING_NOT_FOUND_GRACE_MS &&
    chainStates.length > 0 &&
    chainStates.every((state) => state === 'not_found')
  );
}

function isMissingFromChain(chainStates: TxChainState[]): boolean {
  return chainStates.length > 0 && chainStates.every((state) => state === 'not_found');
}

export const VaultProvider: React.FC<VaultProviderProps> = ({ children }) => {
  const { wallet, currentAccount } = useWallet();
  const { isAuthenticated } = useAuthSession();

  const vault = useVaultDataFetch(isAuthenticated ? wallet : null);
  const {
    vaultData,
    vaultLastUpdated,
    vaultTransactions,
    vaultTransactionsLastUpdated,
    fetchVault,
    fetchVaultTransactions,
  } = vault;

  // ============================================================
  // VAULT TRANSACTION CONFIRMATION CHECK
  // ============================================================
  const pendingVaultTx = usePendingVaultTransactionStore((state) => state.pendingTransaction);
  const pendingVaultChainCheckRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const clearConfirmedPendingVault = (
      confirmedAction: PendingVaultTransaction['action'],
      submittedTxid: string,
      confirmedTxid: string,
      source: 'vault_state' | 'chain'
    ) => {
      logger.info('[VaultContext] Vault transaction confirmed', {
        action: confirmedAction,
        txid: confirmedTxid,
        source,
      });
      logger.info(
        `[E2E_TX] vault_state_applied operation=${confirmedAction} txid=${submittedTxid} vaultTxid=${confirmedTxid} source=${source}`
      );
      usePendingVaultTransactionStore
        .getState()
        .clearPendingTransactionForAccount(currentAccount);
      if (source === 'chain') {
        Promise.resolve(fetchVault()).catch((error) => {
          logger.warn('[VaultContext] Failed to refresh vault after chain confirmation', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
        Promise.resolve(fetchVaultTransactions(undefined, { vaultId: vaultData?.vaultId })).catch(
          (error) => {
            logger.warn('[VaultContext] Failed to refresh vault history after chain confirmation', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        );
      }
      const currentSnackbar = useNotificationStore.getState().snackbar;
      const intentStep = useSendFlowStore.getState().intentStep;
      if (!currentSnackbar && intentStep === 'idle') {
        useNotificationStore.getState().showSnackbar({
          type: 'success',
          action: confirmedAction,
          txid: confirmedTxid,
        });
      } else {
        logger.debug('[VaultContext] Skipping vault confirmation snackbar', {
          hasSnackbar: !!currentSnackbar,
          intentStep,
        });
      }
    };

    if (pendingVaultTx) {
      const pendingConfirmationKey = getPendingVaultConfirmationTxids(pendingVaultTx).join(':');

      const isInHistory = vaultTransactions.some(
        (tx) =>
          tx.transaction_id === pendingVaultTx.txid ||
          tx.transaction_id === pendingVaultTx.vaultTxid
      );
      const isApplied = isPendingVaultTransactionApplied(
        pendingVaultTx,
        vaultData,
        vaultTransactions
      );

      logger.debug('[VaultContext] Checking vault tx confirmation', {
        pendingTxid: pendingVaultTx.txid,
        pendingVaultTxid: pendingVaultTx.vaultTxid,
        pendingAction: pendingVaultTx.action,
        historyCount: vaultTransactions.length,
        historyTxIds: vaultTransactions.slice(0, 5).map((tx) => tx.transaction_id),
        isInHistory,
        isApplied,
      });

      if (isApplied) {
        const confirmedAction = pendingVaultTx.action;
        const confirmedTxid = pendingVaultTx.vaultTxid || pendingVaultTx.txid;
        clearConfirmedPendingVault(
          confirmedAction,
          pendingVaultTx.txid,
          confirmedTxid,
          'vault_state'
        );
      } else if (pendingVaultChainCheckRef.current !== pendingConfirmationKey) {
        pendingVaultChainCheckRef.current = pendingConfirmationKey;
        getPendingVaultChainStates(pendingVaultTx).then(async (chainStates) => {
          if (cancelled) {
            return;
          }

          const currentPending =
            usePendingVaultTransactionStore.getState().pendingTransaction;
          if (
            currentPending?.txid !== pendingVaultTx.txid ||
            currentPending?.vaultTxid !== pendingVaultTx.vaultTxid
          ) {
            return;
          }

          const isConfirmed =
            chainStates.length > 0 && chainStates.every((state) => state === 'confirmed');
          const missingFromChain = isMissingFromChain(chainStates);
          if (!isConfirmed && shouldDiscardMissingRepoPendingTransaction(
            pendingVaultTx,
            chainStates,
          )) {
            const missingTxid = pendingVaultTx.vaultTxid || pendingVaultTx.txid;
            logger.warn('[VaultContext] Discarding old repo pending transaction missing from chain', {
              action: pendingVaultTx.action,
              txid: missingTxid,
              ageMs: Date.now() - pendingVaultTx.timestamp,
            });
            try {
              await usePendingVaultTransactionStore
                .getState()
                .discardPendingTransactionForAccount(
                  currentAccount,
                  missingTxid,
                  'Liquidation repo transaction was not found after the recovery window.',
                );
            } catch (error) {
              logger.warn('[VaultContext] Failed to discard old repo pending transaction', {
                action: pendingVaultTx.action,
                txid: missingTxid,
                error: error instanceof Error ? error.message : String(error),
              });
            }
            return;
          }

          const settledHistory = missingFromChain
            ? findSettledHistoryForStalePendingVaultTransaction(
              pendingVaultTx,
              vaultData,
              vaultTransactions,
            )
            : null;
          if (!isConfirmed && settledHistory) {
            const missingTxid = pendingVaultTx.vaultTxid || pendingVaultTx.txid;
            logger.warn('[VaultContext] Discarding stale pending vault transaction after settled history', {
              action: pendingVaultTx.action,
              txid: missingTxid,
              settledTxid: settledHistory.transaction_id,
              ageMs: Date.now() - pendingVaultTx.timestamp,
            });
            try {
              await usePendingVaultTransactionStore
                .getState()
                .discardPendingTransactionForAccount(
                  currentAccount,
                  missingTxid,
                  'Vault history is already settled; clearing stale pending lock.',
                );
            } catch (error) {
              logger.warn('[VaultContext] Failed to discard stale pending vault transaction', {
                action: pendingVaultTx.action,
                txid: missingTxid,
                error: error instanceof Error ? error.message : String(error),
              });
            }
            return;
          }

          if (!isConfirmed) {
            return;
          }

          const confirmedAction = pendingVaultTx.action;
          const confirmedTxid = pendingVaultTx.vaultTxid || pendingVaultTx.txid;
          logger.info('[VaultContext] Clearing pending vault transaction from chain confirmation fallback', {
            action: confirmedAction,
            txid: confirmedTxid,
          });
          clearConfirmedPendingVault(
            confirmedAction,
            pendingVaultTx.txid,
            confirmedTxid,
            'chain'
          );
        }).finally(() => {
          if (pendingVaultChainCheckRef.current === pendingConfirmationKey) {
            pendingVaultChainCheckRef.current = null;
          }
        });
      }
    }

    return () => {
      cancelled = true;
    };
  }, [
    pendingVaultTx,
    vaultData,
    vaultLastUpdated,
    vaultTransactions,
    vaultTransactionsLastUpdated,
    fetchVault,
    fetchVaultTransactions,
    currentAccount,
  ]);

  // ============================================================
  // VAULT HEALTH ALERTS (local notifications)
  // ============================================================
  const lastHealthAlertRef = useRef<{ warning: number; critical: number }>({
    warning: 0,
    critical: 0,
  });
  const lastHealthBandRef = useRef<VaultHealthBand | null>(null);
  const healthAlertStateLoadedRef = useRef(false);

  const checkVaultHealthAlert = useCallback(async (healthPercent: number): Promise<void> => {
    if (isE2E()) return;

    try {
      const now = Date.now();

      // Load last alert timestamps from storage (first check only)
      if (!healthAlertStateLoadedRef.current) {
        const [warningTs, criticalTs, storedBand] = await Promise.all([
          AsyncStorage.getItem(VAULT_HEALTH_WARNING_KEY),
          AsyncStorage.getItem(VAULT_HEALTH_CRITICAL_KEY),
          AsyncStorage.getItem(VAULT_HEALTH_BAND_KEY),
        ]);
        lastHealthAlertRef.current.warning = warningTs ? parseInt(warningTs, 10) : 0;
        lastHealthAlertRef.current.critical = criticalTs ? parseInt(criticalTs, 10) : 0;
        lastHealthBandRef.current = isVaultHealthBand(storedBand) ? storedBand : null;
        healthAlertStateLoadedRef.current = true;
      }

      const currentBand = getVaultHealthBand(healthPercent);
      const previousBand = lastHealthBandRef.current;
      lastHealthBandRef.current = currentBand;
      await AsyncStorage.setItem(VAULT_HEALTH_BAND_KEY, currentBand);

      if (previousBand === null) {
        return;
      }

      if (currentBand === 'safe') {
        return;
      }

      const shouldSendCriticalAlert = currentBand === 'critical' && previousBand !== 'critical';
      const shouldSendWarningAlert = currentBand === 'warning' && previousBand === 'safe';
      if (!shouldSendCriticalAlert && !shouldSendWarningAlert) {
        return;
      }

      const enabled = await getNotificationsEnabled();
      if (!enabled) return;

      if (currentBand === 'critical' && shouldSendCriticalAlert) {
        // Critical alert
        if (now - lastHealthAlertRef.current.critical >= VAULT_HEALTH_ALERT_INTERVAL_MS) {
          await sendLocalNotification({
            title: 'Vault at Risk!',
            body: `Your vault health is ${healthPercent.toFixed(0)}% - dangerously close to liquidation.`,
            data: { type: 'vault_health' },
          });
          lastHealthAlertRef.current.critical = now;
          await AsyncStorage.setItem(VAULT_HEALTH_CRITICAL_KEY, String(now));
          analytics.track(VAULT_EVENTS.VAULT_HEALTH_WARNING, {
            health_percent: healthPercent,
            level: 'critical',
          });
          logger.info('[VaultContext] Sent critical vault health alert', { healthPercent });
        }
      } else if (currentBand === 'warning' && shouldSendWarningAlert) {
        // Warning alert
        if (now - lastHealthAlertRef.current.warning >= VAULT_HEALTH_ALERT_INTERVAL_MS) {
          await sendLocalNotification({
            title: 'Vault Health Alert',
            body: `Your vault health is ${healthPercent.toFixed(0)}% - consider adding collateral.`,
            data: { type: 'vault_health' },
          });
          lastHealthAlertRef.current.warning = now;
          await AsyncStorage.setItem(VAULT_HEALTH_WARNING_KEY, String(now));
          analytics.track(VAULT_EVENTS.VAULT_HEALTH_WARNING, {
            health_percent: healthPercent,
            level: 'warning',
          });
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
    if ((vaultInfo.unit_borrowed ?? vault.vaultData?.totalDebt ?? 0) <= 0) return;

    // collateral_ratio from the API may be a multiplier (e.g., 1.6) or percentage (e.g., 160)
    // No legitimate vault can have 5000%+ health (50x collateral), so values > 50 are already percentages
    const rawRatio = vaultInfo.collateral_ratio;
    const healthPercent = rawRatio > 50 ? rawRatio : rawRatio * 100;
    if (rawRatio > 50) {
      logger.warn('[VaultContext] collateral_ratio appears to already be a percentage', {
        rawRatio,
      });
    }
    if (typeof healthPercent === 'number' && healthPercent > 0) {
      checkVaultHealthAlert(healthPercent).catch(() => undefined);
    }
  }, [vault.vaultData, checkVaultHealthAlert]);

  return <VaultCtx.Provider value={vault}>{children}</VaultCtx.Provider>;
};
