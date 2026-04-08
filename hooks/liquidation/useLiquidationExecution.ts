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
import { registerLiquidationTxid } from '../../services/transactionHistoryService';
import type { LiquidVaultProfileWithMeta } from '../../services/liquidation/types';
import { usePendingVaultTransactionStore } from '../../stores/pendingVaultTransactionStore';
import { useLiquidationFlowStore } from '../../stores/liquidationFlowStore';
import { logger } from '../../utils/logger';
import { analytics } from '../../services/analyticsService';
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
    vaultInfo?: {
      creation_account: string;
      guard_pubkey: string;
      master_id: string;
    };
  } | null;
}

interface UseLiquidationExecutionReturn {
  execute: () => Promise<void>;
  resetAfterSuccess: () => void;
  resetAfterError: () => void;
}

export function useLiquidationExecution({
  wallet,
  vaultCollateral,
  vaultDebt,
  btcPrice,
  vaultData,
}: UseLiquidationExecutionParams): UseLiquidationExecutionReturn {
  const store = useLiquidationFlowStore;

  const execute = useCallback(async () => {
    const { investAmount, vaultsFull } = store.getState();

    logger.info('[Liquidation] Execute called', {
      investAmount,
      vaultsFullCount: vaultsFull.length,
      firstVaultClaim: vaultsFull[0]?.claimAmountBtc,
    });

    store.getState().setCurrentStep('processing');
    store.getState().setProcessingMessage('Connecting to oracle...');
    analytics.track(LIQUIDATION_EVENTS.LIQUIDATION_CLAIMED, { vault_count: vaultsFull.length, invest_amount: investAmount });

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

      // Compute deficit from selected vaults
      const deficitBtc = selectedVaults.reduce(
        (acc, v) => acc + (v.claimAmountPartial || v.claimAmountBtc),
        0,
      );

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
          creation_account: vaultData?.vaultInfo?.creation_account || '',
          guard_pubkey: vaultData?.vaultInfo?.guard_pubkey || '',
          master_id: vaultData?.vaultInfo?.master_id || '',
        },
        onProgress: (msg) => store.getState().setProcessingMessage(msg),
      });

      if (result.success) {
        store.getState().setResultTxid(result.txid || null);
        store.getState().setCurrentStep('success');
        if (result.txid) analytics.trackTransaction(LIQUIDATION_EVENTS.LIQUIDATION_COMPLETED, result.txid);

        // Add as pending vault transaction
        if (result.txid) {
          void usePendingVaultTransactionStore.getState().setPendingTransaction({
            txid: result.txid,
            vaultTxid: result.vaultTxid,
            action: 'repo' as const,
            btcAmt: Math.round(deficitBtc * 100_000_000),
            unitAmt: Math.round(selectedVaults.reduce((acc, v) => acc + v.unit, 0) * 100),
            timestamp: Date.now(),
            vaultPubkey: wallet?.taprootPubkey || '',
          });
        }

        // Background swap broadcast: wait for repo TX in mempool, then broadcast swap
        if (result.swapPsbtHex && result.txid) {
          void (async () => {
            try {
              store.getState().setProcessingMessage('Waiting for repo TX...');
              const inMempool = await waitForMempool(result.txid!);
              if (!inMempool) {
                logger.warn('[Liquidation] Repo TX not found in mempool, skipping swap broadcast');
                return;
              }

              store.getState().setProcessingMessage('Broadcasting swap...');
              const swapTxid = await broadcastSwapTx(result.swapPsbtHex!);
              if (swapTxid) {
                store.getState().setResultSwapTxid(swapTxid);
                store.getState().setProcessingMessage('Swap broadcast!');
                // Register swap txid so it's tagged properly in history (not shown as random "Sent")
                await registerLiquidationTxid(swapTxid);
                logger.info('[Liquidation] Swap broadcast success', { swapTxid });
              } else {
                logger.warn('[Liquidation] Swap broadcast returned no txid');
              }
            } catch (swapErr: unknown) {
              logger.warn('[Liquidation] Background swap broadcast failed', {
                error: swapErr instanceof Error ? swapErr.message : String(swapErr),
              });
            }
          })();
        }
      } else {
        store.getState().setError(result.error || 'Liquidation failed');
        store.getState().setCurrentStep('error');
      }
    } catch (err: unknown) {
      logger.warn('[Liquidation] Execution error', {
        error: err instanceof Error ? err.message : String(err),
      });
      analytics.track(LIQUIDATION_EVENTS.LIQUIDATION_FAILED, { error: err instanceof Error ? err.message : 'unknown' });
      store.getState().setError(err instanceof Error ? err.message : 'Liquidation failed');
      store.getState().setCurrentStep('error');
    }
  }, [wallet, vaultCollateral, vaultDebt, btcPrice, vaultData]);

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
