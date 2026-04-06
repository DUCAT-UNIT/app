/**
 * useLiquidationVaults
 * Manages vault fetching, polling, and max investable calculation.
 * Replaces the inline refreshLiqVaults + polling useEffect + maxInvestable useMemo
 * from LiquidationScreen.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { fetchLiquidatableVaults } from '../../services/liquidation/fetchVaults';
import {
  computeLiquidVaultProfiles,
  getMaxInvest,
  getAvailableCollateralBtc,
} from '../../services/liquidation/calculations';
import { LIQ_MAX_CLAIM_AMOUNT_BTC, LIQ_DEFAULT_FEE_RATE } from '../../services/liquidation/constants';
import type { LiqVaultDisplay } from '../../services/liquidation/types';
import { fetchProtocolContract } from '../../services/vaultWallet';
import { useLiquidationFlowStore } from '../../stores/liquidationFlowStore';
import { logger } from '../../utils/logger';

const POLL_INTERVAL_MS = 30_000;

interface UseLiquidationVaultsParams {
  btcPrice: number | null;
  segwitBalance: number;
  taprootBalance: number;
  vaultCollateral: number;
  vaultDebt: number;
  hasVault: boolean;
  visible: boolean;
}

interface UseLiquidationVaultsReturn {
  maxInvestable: number;
  refreshLiqVaults: () => Promise<void>;
}

export function useLiquidationVaults({
  btcPrice,
  segwitBalance,
  taprootBalance,
  vaultCollateral,
  vaultDebt,
  hasVault,
  visible,
}: UseLiquidationVaultsParams): UseLiquidationVaultsReturn {
  const store = useLiquidationFlowStore;
  const fetchStatus = store((s) => s.fetchStatus);
  const currentStep = store((s) => s.currentStep);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchInFlightRef = useRef(false);

  const refreshLiqVaults = useCallback(async () => {
    if (!btcPrice || fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    store.getState().setFetchStatus('loading');

    try {
      const [raw, contract] = await Promise.all([
        fetchLiquidatableVaults(),
        fetchProtocolContract(),
      ]);
      const currentPrice = btcPrice || 67000;
      logger.debug('[Liquidation] Fetch result', { rawCount: raw.length, price: currentPrice });

      // Use computeLiquidVaultProfiles from calculations.ts (no duplication)
      const fullProfiles = computeLiquidVaultProfiles(raw, currentPrice, contract);

      // Derive display projections
      const displayProfiles: LiqVaultDisplay[] = fullProfiles.map((p) => ({
        vaultId: p.vaultId,
        unit: p.unit,
        btcInVault: p.btcInVault,
        claimAmountBtc: p.claimAmountBtc,
        profitBtc: p.profitBtc,
        profitPercent: p.profitPercent,
        postTaxBtcInVault: p.postTaxBtcInVault,
        unitSwapBtc: p.unitSwapBtc,
      }));

      // Compute ratios from first vault
      let profitRate = 0;
      let depositRate = 0;
      let swapRate = 0;
      if (displayProfiles.length > 0) {
        const first = displayProfiles[0];
        profitRate = first.profitPercent / 100;
        const totalRequired = first.claimAmountBtc + first.unitSwapBtc;
        if (totalRequired > 0) {
          depositRate = first.claimAmountBtc / totalRequired;
          swapRate = first.unitSwapBtc / totalRequired;
        }
      }

      store.getState().setVaultData(displayProfiles, fullProfiles, profitRate, depositRate, swapRate);
      store.getState().setFetchStatus('loaded');

      logger.debug('[Liquidation] Vaults ready', {
        display: displayProfiles.length,
        full: fullProfiles.length,
      });
    } catch (fetchErr: unknown) {
      logger.warn('[Liquidation] Fetch failed', {
        error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
      });
      store.getState().setFetchStatus('error');
    } finally {
      fetchInFlightRef.current = false;
    }
  }, [btcPrice]);

  // Poll every 30s while visible and on input screen
  useEffect(() => {
    if (visible && currentStep === 'input') {
      pollingRef.current = setInterval(() => {
        void refreshLiqVaults();
      }, POLL_INTERVAL_MS);
      logger.debug('[Liquidation] Polling started (30s interval)');
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        logger.debug('[Liquidation] Polling stopped');
      }
    };
  }, [visible, currentStep, refreshLiqVaults]);

  // Initial fetch when becoming visible
  useEffect(() => {
    if (visible) {
      void refreshLiqVaults();
    }
  }, [visible, refreshLiqVaults]);

  // Compute max investable from vault data + wallet constraints
  const vaultsFull = store((s) => s.vaultsFull);
  const maxInvestable = useMemo(() => {
    if (!btcPrice || vaultsFull.length === 0) return 0;
    const walletSats = Math.round(((segwitBalance || 0) + (taprootBalance || 0)) * 100_000_000);
    const availableCollateral = hasVault
      ? getAvailableCollateralBtc(btcPrice, vaultCollateral || 0, vaultDebt || 0)
      : walletSats / 100_000_000;
    const stats = getMaxInvest(
      true,
      availableCollateral,
      walletSats,
      btcPrice,
      LIQ_DEFAULT_FEE_RATE,
      vaultsFull,
      LIQ_MAX_CLAIM_AMOUNT_BTC,
    );
    logger.debug('[Liquidation] maxInvest calc', {
      walletSats,
      availableCollateral,
      vaultCount: vaultsFull.length,
      result: stats.maxInvestBtc,
    });
    return stats.maxInvestBtc;
  }, [btcPrice, segwitBalance, taprootBalance, vaultCollateral, vaultDebt, hasVault, vaultsFull, fetchStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  return { maxInvestable, refreshLiqVaults };
}
