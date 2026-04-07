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

const POLL_INTERVAL_ACTIVE_MS = 30_000;  // 30s when screen is open
const POLL_INTERVAL_BG_MS = 120_000;    // 2 min background prefetch

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
    // Only set loading on first fetch to avoid re-renders during polling
    if (store.getState().fetchStatus === 'idle') {
      store.getState().setFetchStatus('loading');
    }

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

      // Batch store update into a single set() call to avoid multiple re-renders
      const prev = store.getState();
      const vaultsChanged = prev.vaults.length !== displayProfiles.length
        || displayProfiles.some((v, i) => prev.vaults[i]?.vaultId !== v.vaultId);

      if (vaultsChanged || prev.fetchStatus !== 'loaded') {
        store.setState({
          vaults: displayProfiles,
          vaultsFull: fullProfiles,
          profitRate,
          depositRate,
          swapRate,
          fetchStatus: 'loaded',
        });
      }

      logger.debug('[Liquidation] Vaults ready', {
        display: displayProfiles.length,
        full: fullProfiles.length,
        changed: vaultsChanged,
      });
    } catch (fetchErr: unknown) {
      logger.warn('[Liquidation] Fetch failed', {
        error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
      });
      if (store.getState().fetchStatus !== 'error') {
        store.getState().setFetchStatus('error');
      }
    } finally {
      fetchInFlightRef.current = false;
    }
  }, [btcPrice]);

  // Background prefetch — start fetching immediately on mount, poll every 2 min
  // so data is ready when user opens the liquidation screen
  useEffect(() => {
    if (!btcPrice) return;
    void refreshLiqVaults();
    const interval = visible && currentStep === 'input'
      ? POLL_INTERVAL_ACTIVE_MS   // 30s when screen is open
      : POLL_INTERVAL_BG_MS;      // 2 min background
    pollingRef.current = setInterval(() => {
      void refreshLiqVaults();
    }, interval);
    logger.debug('[Liquidation] Polling started', { interval, visible });
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [btcPrice, visible, currentStep, refreshLiqVaults]);

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
