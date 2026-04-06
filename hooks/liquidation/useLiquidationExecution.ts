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
import type { LiquidVaultProfileWithMeta } from '../../services/liquidation/types';
import { usePendingVaultTransactionStore } from '../../stores/pendingVaultTransactionStore';
import { useLiquidationFlowStore } from '../../stores/liquidationFlowStore';
import { logger } from '../../utils/logger';

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
      } else {
        store.getState().setError(result.error || 'Liquidation failed');
        store.getState().setCurrentStep('error');
      }
    } catch (err: unknown) {
      logger.warn('[Liquidation] Execution error', {
        error: err instanceof Error ? err.message : String(err),
      });
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
  }, []);

  return { execute, resetAfterSuccess, resetAfterError };
}
