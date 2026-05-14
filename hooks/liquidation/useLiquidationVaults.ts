/**
 * useLiquidationVaults
 * Manages vault fetching, polling, and max investable calculation.
 * Replaces the inline refreshLiqVaults + polling useEffect + maxInvestable useMemo
 * from LiquidationScreen.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchLiquidatableVaults } from '../../services/liquidation/fetchVaults';
import {
  computeLiquidVaultProfiles,
  getMaxInvest,
  getAvailableCollateralBtc,
} from '../../services/liquidation/calculations';
import { LIQ_MAX_CLAIM_AMOUNT_BTC, LIQ_DEFAULT_FEE_RATE } from '../../services/liquidation/constants';
import type { LiqVaultDisplay, ValidatorLiquidatedVault } from '../../services/liquidation/types';
import { fetchProtocolContract, prefetchProtocolContract } from '../../services/vaultWallet';
import { fetchBtcPrice } from '../../services/balanceService';
import type { ProtocolProfile } from '@ducat-unit/client-sdk';
import { useLiquidationFlowStore } from '../../stores/liquidationFlowStore';
import { useSwapDiagnosticsStore } from '../../stores/swapDiagnosticsStore';
import { sendLocalNotification } from '../../services/pushNotificationService';
import { getNotificationsEnabled } from '../../services/settingsService';
import { isE2E } from '../../utils/e2e';
import { logger } from '../../utils/logger';

const POLL_INTERVAL_ACTIVE_MS = 30_000;  // 30s when screen is open
const POLL_INTERVAL_BG_MS = 120_000;    // 2 min background prefetch
const LIQ_ALERT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hour throttle
const LIQ_CONTRACT_FETCH_TIMEOUT_MS = 12_000;

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

function deriveBtcPrice(rawVaults: ValidatorLiquidatedVault[]): number | null {
  for (const vault of rawVaults) {
    const candidates = [
      vault.quote?.latest_price,
      vault.quote?.quote_price,
      vault.stone?.oracle_price,
      vault.quote?.thold_price,
    ];
    const price = candidates.find((candidate) => typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0);
    if (price) {
      return price;
    }
  }
  return null;
}

async function fetchProtocolContractWithTimeout(): Promise<ProtocolProfile> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error('Timed out loading liquidation protocol contract')),
      LIQ_CONTRACT_FETCH_TIMEOUT_MS,
    );
    (timeoutId as { unref?: () => void }).unref?.();
  });

  try {
    return await Promise.race([fetchProtocolContract(), timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
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
  const diagnosticsPollIdRef = useRef<string | null>(null);
  const fetchInFlightRef = useRef(false);
  const prevVaultCountRef = useRef<number>(-1);
  const lastLiqAlertRef = useRef<number>(0);
  const [fallbackBtcPrice, setFallbackBtcPrice] = useState<number | null>(null);
  const effectiveBtcPrice = btcPrice ?? fallbackBtcPrice;

  const refreshLiqVaults = useCallback(async () => {
    const pollId = diagnosticsPollIdRef.current;
    if (fetchInFlightRef.current) {
      if (pollId) {
        useSwapDiagnosticsStore.getState().recordAttempt(pollId, {
          lastStatus: 'skipped',
          lastMessage: 'Previous liquidation vault refresh is still in flight',
        });
      }
      return;
    }
    // Don't update vault data while user is reviewing or executing
    const step = store.getState().currentStep;
    if (step === 'review' || step === 'processing') {
      if (pollId) {
        useSwapDiagnosticsStore.getState().recordAttempt(pollId, {
          lastStatus: 'paused',
          lastMessage: `Paused while liquidation flow is ${step}`,
          metadata: {
            currentStep: step,
          },
        });
      }
      return;
    }

    fetchInFlightRef.current = true;
    // Only set loading on first fetch to avoid re-renders during polling
    if (store.getState().fetchStatus === 'idle') {
      store.getState().setFetchStatus('loading');
    }

    try {
      const pricePromise = btcPrice
        ? Promise.resolve(btcPrice)
        : fetchBtcPrice().catch(() => null);
      const raw = await fetchLiquidatableVaults();

      if (raw.length === 0) {
        const prev = store.getState();
        const hadVaults = prev.vaults.length > 0 || prev.vaultsFull.length > 0;
        if (hadVaults || prev.fetchStatus !== 'loaded') {
          store.setState({
            vaults: [],
            vaultsFull: [],
            profitRate: 0,
            depositRate: 0,
            swapRate: 0,
            fetchStatus: 'loaded',
          });
        }
        prevVaultCountRef.current = 0;
        if (pollId) {
          useSwapDiagnosticsStore.getState().recordAttempt(pollId, {
            lastStatus: 'loaded',
            lastMessage: 'No liquidatable vaults returned by validator',
            metadata: {
              vaultCount: 0,
              fetchStatus: store.getState().fetchStatus,
              visible,
              currentStep: store.getState().currentStep,
            },
          });
        }
        return;
      }

      const currentPrice = btcPrice ?? deriveBtcPrice(raw) ?? await pricePromise;
      if (!currentPrice) {
        throw new Error('BTC price unavailable for liquidation vault calculation');
      }
      if (!btcPrice) {
        setFallbackBtcPrice(currentPrice);
      }

      const contract = await fetchProtocolContractWithTimeout();
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
      if (pollId) {
        useSwapDiagnosticsStore.getState().recordAttempt(pollId, {
          lastStatus: 'loaded',
          lastMessage: vaultsChanged ? 'Liquidation vault set changed' : 'Liquidation vault set unchanged',
          metadata: {
            vaultCount: displayProfiles.length,
            fullProfileCount: fullProfiles.length,
            vaultsChanged,
            fetchStatus: store.getState().fetchStatus,
            visible,
            currentStep: store.getState().currentStep,
          },
        });
      }

      // Send liquidation opportunity notification when new vaults appear
      if (!isE2E() && vaultsChanged && prevVaultCountRef.current >= 0) {
        const newCount = displayProfiles.length;
        if (newCount > prevVaultCountRef.current) {
          const now = Date.now();
          if (now - lastLiqAlertRef.current >= LIQ_ALERT_INTERVAL_MS) {
            const notificationsEnabled = await getNotificationsEnabled();
            if (notificationsEnabled) {
              const added = newCount - prevVaultCountRef.current;
              void sendLocalNotification({
                title: 'Liquidation Opportunity',
                body: `${added} new vault${added > 1 ? 's' : ''} available for liquidation.`,
                data: { type: 'liquidation_opportunity' },
              });
              lastLiqAlertRef.current = now;
              logger.info('[Liquidation] Sent opportunity alert', { added, total: newCount });
            }
          }
        }
      }
      prevVaultCountRef.current = displayProfiles.length;
    } catch (fetchErr: unknown) {
      logger.warn('[Liquidation] Fetch failed', {
        error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
      });
      if (store.getState().fetchStatus !== 'error') {
        store.getState().setFetchStatus('error');
      }
      if (pollId) {
        useSwapDiagnosticsStore.getState().recordAttempt(pollId, {
          lastStatus: 'error',
          lastError: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
          metadata: {
            fetchStatus: store.getState().fetchStatus,
            visible,
            currentStep: store.getState().currentStep,
          },
        });
      }
    } finally {
      fetchInFlightRef.current = false;
    }
  }, [btcPrice, visible]);

  useEffect(() => {
    prefetchProtocolContract();
  }, []);

  // Background prefetch — start fetching immediately on mount, poll every 2 min
  // so data is ready when user opens the liquidation screen
  useEffect(() => {
    const interval = visible && currentStep === 'input'
      ? POLL_INTERVAL_ACTIVE_MS   // 30s when screen is open
      : POLL_INTERVAL_BG_MS;      // 2 min background
    const pollId = useSwapDiagnosticsStore.getState().startPoll({
      id: 'liquidation-vaults',
      kind: 'liquidation_vaults',
      label: 'Liquidation vault refresh',
      subject: visible ? 'active' : 'background',
      intervalMs: interval,
      metadata: {
        visible,
        currentStep,
        btcPrice,
      },
    });
    diagnosticsPollIdRef.current = pollId;
    void refreshLiqVaults();
    pollingRef.current = setInterval(() => {
      void refreshLiqVaults();
    }, interval);
    (pollingRef.current as { unref?: () => void }).unref?.();
    logger.debug('[Liquidation] Polling started', { interval, visible });
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (diagnosticsPollIdRef.current === pollId) {
        useSwapDiagnosticsStore.getState().stopPoll(pollId, 'Liquidation vault polling stopped');
        diagnosticsPollIdRef.current = null;
      }
    };
  }, [btcPrice, visible, currentStep, refreshLiqVaults]);

  // Compute max investable from vault data + wallet constraints
  const vaultsFull = store((s) => s.vaultsFull);
  const maxInvestable = useMemo(() => {
    if (!effectiveBtcPrice || vaultsFull.length === 0) return 0;
    const walletSats = Math.round(((segwitBalance || 0) + (taprootBalance || 0)) * 100_000_000);
    const availableCollateral = hasVault
      ? getAvailableCollateralBtc(effectiveBtcPrice, vaultCollateral || 0, vaultDebt || 0)
      : walletSats / 100_000_000;
    const stats = getMaxInvest(
      true,
      availableCollateral,
      walletSats,
      effectiveBtcPrice,
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
  }, [effectiveBtcPrice, segwitBalance, taprootBalance, vaultCollateral, vaultDebt, hasVault, vaultsFull, fetchStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  return { maxInvestable, refreshLiqVaults };
}
