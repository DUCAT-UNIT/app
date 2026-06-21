/**
 * useLiquidationExecution
 * Handles vault selection, partial recomputation, and execution.
 * Replaces the 117-line inline onPress handler from LiquidationScreen.
 */

import { useCallback } from 'react';
import {
  selectItemsForAmount,
  recomputePartialVaultProfile,
} from '../../services/liquidation/calculations';
import { LIQ_DEFAULT_FEE_RATE } from '../../services/liquidation/constants';
import { executeLiquidation } from '../../services/liquidation/execution';
import { waitForMempool, broadcastSwapTx } from '../../services/liquidation/swapService';
import {
  clearPendingLiquidationSwapBroadcast,
  savePendingLiquidationSwapBroadcast,
} from '../../services/liquidation/liquidationSwapBroadcastRecovery';
import { registerSwapTxid } from '../../services/transactionHistoryService';
import type { LiquidVaultProfileWithMeta } from '../../services/liquidation/types';
import {
  usePendingVaultTransactionStore,
  type VaultAction,
} from '../../stores/pendingVaultTransactionStore';
import { useLiquidationFlowStore } from '../../stores/liquidationFlowStore';
import { useSwapDiagnosticsStore } from '../../stores/swapDiagnosticsStore';
import { logger } from '../../utils/logger';
import { analytics } from '../../services/analyticsService';
import { sendLocalNotification, watchTransaction } from '../../services/pushNotificationService';
import { formatUnitAmount } from '../../utils/formatters/amounts';
import { isStaleLiquidationOpportunityError } from '../../utils/liquidationErrors';
import { LIQUIDATION_EVENTS } from '../../constants/analyticsEvents';

interface UseLiquidationExecutionParams {
  wallet: {
    segwitAddress: string;
    segwitPubkey: string;
    taprootAddress: string;
    taprootPubkey: string;
  } | null;
  vaultCollateral: number;
  vaultDebt: number;
  btcPrice: number | null;
  vaultData: {
    vaultId?: string;
    vaultInfo?: {
      creation_account: string;
      guard_pubkey: string;
      master_id: string;
    };
  } | null;
  currentAccount: number;
}

interface UseLiquidationExecutionReturn {
  execute: () => Promise<void>;
  resetAfterSuccess: () => void;
  resetAfterError: () => void;
}

function hasPartialLiquidationSelection(vaults: LiquidVaultProfileWithMeta[]): boolean {
  return vaults.some((vault) => {
    const claimAmountPartial = Number(vault.claimAmountPartial);
    const claimAmountBtc = Number(vault.claimAmountBtc);
    const claimAmountDiff = Number(vault.claimAmountDiff);

    return (
      (Number.isFinite(claimAmountDiff) && claimAmountDiff > 0) ||
      (
        Number.isFinite(claimAmountPartial) &&
        claimAmountPartial > 0 &&
        Number.isFinite(claimAmountBtc) &&
        claimAmountPartial < claimAmountBtc
      )
    );
  });
}

function extractLiquidationFailureText(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }
  if (typeof reason === 'string') {
    return reason;
  }
  if (reason && typeof reason === 'object') {
    try {
      return JSON.stringify(reason);
    } catch {
      return String(reason);
    }
  }
  return String(reason);
}

function shouldRetainPreSubmitPendingTransaction(reason: unknown): boolean {
  if (isStaleLiquidationOpportunityError(extractLiquidationFailureText(reason))) {
    return false;
  }

  const text = extractLiquidationFailureText(reason)
    .replace(/\\"/g, '"')
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return [
    /timeout|timed out/i,
    /network request failed|network error|fetch failed/i,
    /socket|websocket/i,
    /connection.*(?:closed|reset|lost)|disconnected|disconnect/i,
    /interrupted/i,
  ].some((pattern) => pattern.test(text));
}

export function useLiquidationExecution({
  wallet,
  vaultCollateral,
  vaultDebt,
  btcPrice,
  vaultData,
  currentAccount,
}: UseLiquidationExecutionParams): UseLiquidationExecutionReturn {
  const store = useLiquidationFlowStore;

  const execute = useCallback(async () => {
    const { investAmount, vaultsFull } = store.getState();

    logger.info('[Liquidation] Execute called', {
      investAmount,
      vaultsFullCount: vaultsFull.length,
      firstVaultClaim: vaultsFull[0]?.claimAmountBtc,
    });

    let preSubmitSwapRecoveryRepoTxid: string | null = null;
    let preSubmitPendingRepoTxid: string | null = null;

    const handlePreSubmitPendingFailure = async (reason: unknown): Promise<void> => {
      if (!preSubmitPendingRepoTxid) {
        return;
      }

      if (!shouldRetainPreSubmitPendingTransaction(reason)) {
        await discardPreSubmitPendingTransaction(reason);
        return;
      }

      logger.warn('[Liquidation] Keeping pre-submit repo recovery after ambiguous failure', {
        txid: preSubmitPendingRepoTxid,
        hasSwapRecovery: !!preSubmitSwapRecoveryRepoTxid,
        reason: reason instanceof Error ? reason.message : String(reason),
      });
    };

    const discardPreSubmitPendingTransaction = async (reason: unknown): Promise<void> => {
      if (!preSubmitPendingRepoTxid) {
        return;
      }

      logger.info('[Liquidation] Discarding pre-submit repo recovery after rejected failure', {
        txid: preSubmitPendingRepoTxid,
        hasSwapRecovery: !!preSubmitSwapRecoveryRepoTxid,
        reason: reason instanceof Error ? reason.message : String(reason),
      });

      try {
        await usePendingVaultTransactionStore
          .getState()
          .discardPendingTransactionForAccount(currentAccount, preSubmitPendingRepoTxid, reason);
      } catch (pendingError) {
        logger.warn('[Liquidation] Failed to discard stale repo pending recovery', {
          txid: preSubmitPendingRepoTxid,
          error: pendingError instanceof Error ? pendingError.message : String(pendingError),
        });
      }

      if (!preSubmitSwapRecoveryRepoTxid) {
        return;
      }

      try {
        await clearPendingLiquidationSwapBroadcast(preSubmitSwapRecoveryRepoTxid);
      } catch (swapRecoveryError) {
        logger.warn('[Liquidation] Failed to clear stale repo swap recovery', {
          txid: preSubmitSwapRecoveryRepoTxid,
          error: swapRecoveryError instanceof Error
            ? swapRecoveryError.message
            : String(swapRecoveryError),
        });
      }
    };

    try {
      // Select vaults (uses selectItemsForAmount — no duplicate greedy loop)
      const claimed = selectItemsForAmount(vaultsFull, investAmount);
      logger.info('[Liquidation] Vault selection', {
        claimedCount: claimed.length,
        hasPartial: claimed.some(v => !!v.claimAmountPartial),
        totalClaim: claimed.reduce((a, v) => a + (v.claimAmountPartial || v.claimAmountBtc), 0),
      });
      if (claimed.length === 0) {
        store.getState().setError('Investment amount too small to claim any vault.');
        store.getState().setCurrentStep('error');
        return;
      }

      const claimedVaultIds = claimed.map((vault) => vault.vaultId).filter(Boolean);
      if (!store.getState().beginExecution(claimedVaultIds)) {
        logger.warn('[Liquidation] Ignoring duplicate execution request while one is in progress');
        return;
      }

      store.getState().setCurrentStep('processing');
      store.getState().setProcessingMessage('Connecting to oracle...');
      analytics.track(LIQUIDATION_EVENTS.LIQUIDATION_CLAIMED, { vault_count: vaultsFull.length, invest_amount: investAmount });

      // Separate full and partial vaults
      const claimedFull = claimed.filter((v) => !v.claimAmountPartial);
      const claimedPartial = claimed.find((v) => !!v.claimAmountPartial);

      // Re-compute partial vault profile with repo_portion
      let selectedVaults: LiquidVaultProfileWithMeta[];
      if (claimedPartial) {
        try {
          const recomputedPartial = await recomputePartialVaultProfile(
            claimedPartial,
            btcPrice || 0,
          );
          // Partial vault first (matches web frontend order)
          selectedVaults = [recomputedPartial, ...claimedFull];
        } catch {
          selectedVaults = claimedFull;
        }
      } else {
        selectedVaults = claimedFull;
      }

      if (selectedVaults.length === 0) {
        store.getState().releaseVaults(claimedVaultIds);
        store.getState().setError('Investment amount too small to claim any vault.');
        store.getState().setCurrentStep('error');
        return;
      }

      // Compute deficit from selected vaults
      const deficitBtc = selectedVaults.reduce(
        (acc, v) => acc + (v.claimAmountPartial || v.claimAmountBtc),
        0,
      );
      const unitAmt = Math.round(selectedVaults.reduce((acc, v) => acc + v.unit, 0) * 100);
      const swapUnitAmount = selectedVaults.reduce((acc, v) => acc + v.unit, 0);
      const pendingLiquidationAction: VaultAction = hasPartialLiquidationSelection(selectedVaults)
        ? 'trim'
        : 'repo';

      const persistRepoPendingTransaction = async (txid: string, vaultTxid?: string) => {
        await usePendingVaultTransactionStore.getState().setPendingTransactionForAccount({
          txid,
          vaultTxid,
          action: pendingLiquidationAction,
          btcAmt: Math.round(deficitBtc * 100_000_000),
          unitAmt,
          timestamp: Date.now(),
          vaultPubkey: wallet?.taprootPubkey || '',
        }, currentAccount);
      };

      const persistSwapBroadcastRecovery = async (
        repoTxid: string,
        swapTxHex: string
      ): Promise<void> => {
        await savePendingLiquidationSwapBroadcast({
          repoTxid,
          swapTxHex,
          unitAmount: swapUnitAmount,
          createdAt: Date.now(),
        });
      };

      const result = await executeLiquidation({
        liquidVaults: selectedVaults,
        walletInfo: {
          segwitAddress: wallet?.segwitAddress || '',
          segwitPubkey: wallet?.segwitPubkey || '',
          taprootAddress: wallet?.taprootAddress || '',
          taprootPubkey: wallet?.taprootPubkey || '',
        },
        vaultPubkey: wallet?.taprootPubkey || '',
        btcInVault: vaultCollateral || 0,
        unitDebt: vaultDebt || 0,
        feeRate: LIQ_DEFAULT_FEE_RATE,
        deficitAmountBtc: deficitBtc,
        vaultInfo: {
          vault_id: vaultData?.vaultId || '',
          creation_account: vaultData?.vaultInfo?.creation_account || '',
          guard_pubkey: vaultData?.vaultInfo?.guard_pubkey || '',
          master_id: vaultData?.vaultInfo?.master_id || '',
        },
        onProgress: (msg) => store.getState().setProcessingMessage(msg),
        onRequestCreated: async ({ txid, vaultTxid, swapPsbtHex }) => {
          await persistRepoPendingTransaction(txid, vaultTxid);
          preSubmitPendingRepoTxid = vaultTxid || txid;
          if (swapPsbtHex) {
            await persistSwapBroadcastRecovery(txid, swapPsbtHex);
            preSubmitSwapRecoveryRepoTxid = txid;
          }
        },
      });

      if (result.success) {
        store.getState().markVaultsClaimed(claimedVaultIds);
        store.getState().setResultTxid(result.txid || null);
        if (result.txid) analytics.trackTransaction(LIQUIDATION_EVENTS.LIQUIDATION_COMPLETED, result.txid);

        // Register liquidation TX for push-notification monitoring (fire-and-forget)
        if (result.txid) {
          void watchTransaction(result.txid, wallet?.segwitAddress || '', 'liquidation');
        }

        // Add as pending vault transaction
        if (result.txid) {
          await persistRepoPendingTransaction(result.txid, result.vaultTxid).catch((pendingError) => {
            logger.error('[Liquidation] Liquidation submitted but pending vault lock could not be persisted', {
              txid: result.txid,
              action: pendingLiquidationAction,
              error: pendingError instanceof Error ? pendingError.message : String(pendingError),
            });
          });
        }

        // Background swap broadcast: wait for repo TX in mempool, then broadcast swap
        if (result.swapPsbtHex && result.txid) {
          await persistSwapBroadcastRecovery(result.txid, result.swapPsbtHex);
          if (preSubmitSwapRecoveryRepoTxid && preSubmitSwapRecoveryRepoTxid !== result.txid) {
            await clearPendingLiquidationSwapBroadcast(preSubmitSwapRecoveryRepoTxid);
          }

          void (async () => {
            const swapPollId = useSwapDiagnosticsStore.getState().startPoll({
              id: `liquidation-swap-broadcast:${result.txid}`,
              kind: 'liquidation_swap_broadcast',
              label: 'Liquidation swap broadcast',
              subject: result.txid,
              metadata: {
                repoTxid: result.txid,
              },
            });

            try {
              store.getState().setProcessingMessage('Waiting for repo TX...');
              useSwapDiagnosticsStore.getState().recordAttempt(swapPollId, {
                lastStatus: 'waiting_repo_mempool',
                lastMessage: 'Waiting for repo transaction before swap broadcast',
              });
              const inMempool = await waitForMempool(result.txid!);
              if (!inMempool) {
                useSwapDiagnosticsStore.getState().completePoll(swapPollId, {
                  status: 'timeout',
                  lastStatus: 'repo_mempool_timeout',
                  lastMessage: 'Repo transaction was not found; swap broadcast skipped',
                });
                logger.warn('[Liquidation] Repo TX not found in mempool, skipping swap broadcast');
                return;
              }

              store.getState().setProcessingMessage('Broadcasting swap...');
              useSwapDiagnosticsStore.getState().recordAttempt(swapPollId, {
                lastStatus: 'broadcasting',
                lastMessage: 'Broadcasting finalized swap transaction',
              });
              const swapTxid = await broadcastSwapTx(result.swapPsbtHex!);
              if (swapTxid) {
                store.getState().setResultSwapTxid(swapTxid);
                store.getState().setProcessingMessage('Swap broadcast!');
                useSwapDiagnosticsStore.getState().completePoll(swapPollId, {
                  status: 'success',
                  lastStatus: 'broadcast',
                  lastMessage: 'Liquidation swap broadcast completed',
                  metadata: {
                    swapTxid,
                  },
                });
                // Register swap txid so it shows as "Swap" in history with UNIT amount
                await registerSwapTxid(swapTxid, swapUnitAmount);
                await clearPendingLiquidationSwapBroadcast(result.txid!);
                logger.info('[Liquidation] Swap broadcast success', { swapTxid });
                // Notify user that UNIT swap arrived
                void sendLocalNotification({
                  title: 'UNIT Swap Complete',
                  body: `You received ${formatUnitAmount(swapUnitAmount)} UNIT from your liquidation swap.`,
                  data: { type: 'swap_complete', txid: swapTxid },
                });
              } else {
                useSwapDiagnosticsStore.getState().completePoll(swapPollId, {
                  status: 'error',
                  lastStatus: 'broadcast_failed',
                  lastMessage: 'Swap broadcast returned no txid',
                });
                logger.warn('[Liquidation] Swap broadcast returned no txid');
              }
            } catch (swapErr: unknown) {
              useSwapDiagnosticsStore.getState().completePoll(swapPollId, {
                status: 'error',
                lastStatus: 'error',
                lastError: swapErr instanceof Error ? swapErr.message : String(swapErr),
              });
              logger.warn('[Liquidation] Background swap broadcast failed', {
                error: swapErr instanceof Error ? swapErr.message : String(swapErr),
              });
            }
          })();
        }
        store.getState().setCurrentStep('success');
      } else {
        const errorMessage = result.error || 'Liquidation failed';
        const staleOpportunity = isStaleLiquidationOpportunityError(errorMessage);
        if (staleOpportunity) {
          await discardPreSubmitPendingTransaction(errorMessage);
          store.getState().markVaultsClaimed(claimedVaultIds);
        } else {
          await handlePreSubmitPendingFailure(errorMessage);
          store.getState().releaseVaults(claimedVaultIds);
        }
        store.getState().setError(errorMessage);
        store.getState().setCurrentStep('error');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Liquidation failed';
      const executingVaultIds = store.getState().executingVaultIds;
      const staleOpportunity = isStaleLiquidationOpportunityError(errorMessage);
      if (staleOpportunity) {
        await discardPreSubmitPendingTransaction(err);
        store.getState().markVaultsClaimed(executingVaultIds);
      } else {
        await handlePreSubmitPendingFailure(err);
        store.getState().releaseVaults(executingVaultIds);
      }
      logger.warn('[Liquidation] Execution error', {
        error: errorMessage,
      });
      analytics.track(LIQUIDATION_EVENTS.LIQUIDATION_FAILED, { error: errorMessage });
      store.getState().setError(errorMessage);
      store.getState().setCurrentStep('error');
    }
  }, [wallet, vaultCollateral, vaultDebt, btcPrice, vaultData, currentAccount]);

  const resetAfterSuccess = useCallback(() => {
    store.getState().reset();
  }, []);

  const resetAfterError = useCallback(() => {
    store.getState().setCurrentStep('input');
    store.getState().setError(null);
    store.getState().setResultTxid(null);
    store.getState().setResultSwapTxid(null);
  }, []);

  return { execute, resetAfterSuccess, resetAfterError };
}
