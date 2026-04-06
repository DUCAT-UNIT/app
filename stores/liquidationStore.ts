/**
 * Liquidation Store
 *
 * Zustand store managing liquidation state:
 * - Liquidatable vault list (fetched from validator)
 * - Selected vaults for current claim
 * - Investment amount and computed breakdown
 * - Loading/error state
 */

import { create } from 'zustand';
import {
  fetchLiquidatableVaults,
  formatValidatorResponse,
  selectItemsForAmount,
  computeClaimFromInvest,
  getTotalEstimatedProfit,
  getEstimatedProfitAveragePercent,
  getClaimedDebtUnits,
  getTotalClaimBtc,
  getAvailableCollateralBtc,
  COIN_SIZE,
} from '../services/liquidation';
import type {
  ValidatorLiquidatedVault,
  LiquidVaultProfileWithMeta,
  LiquidationVaultComputedData,
  ClaimFromInvestResult,
} from '../services/liquidation/types';
import { computeLiqMeta } from '../services/liquidation/calculations';
import { logger } from '../utils/logger';

interface LiquidationState {
  // Raw data
  rawVaults: ValidatorLiquidatedVault[];
  vaults: LiquidationVaultComputedData[];

  // Selection
  selectedVaults: LiquidationVaultComputedData[];
  investAmount: number;

  // Computed from selection
  totalClaimBtc: number;
  totalProfitBtc: number;
  avgProfitPercent: number;
  claimedDebtUnits: number;
  depositBtc: number;       // Your deposit portion
  swapBtc: number;          // You swap to UNIT portion

  // User's vault context
  userBtcInVault: number;
  userUnitDebt: number;

  // UI state
  loading: boolean;
  error: string | null;
  lastFetch: number;
}

interface LiquidationActions {
  /** Fetch liquidatable vaults from validator */
  fetchVaults: (btcPrice: number) => Promise<void>;

  /** Set investment amount and recompute selection */
  setInvestAmount: (amount: number, btcPrice: number, feeRate?: number) => void;

  /** Set user's vault context for available collateral calculation */
  setUserVaultContext: (btcInVault: number, unitDebt: number) => void;

  /** Get max investable amount */
  getMaxInvestable: (btcPrice: number) => number;

  /** Reset store */
  reset: () => void;
}

type LiquidationStore = LiquidationState & LiquidationActions;

const initialState: LiquidationState = {
  rawVaults: [],
  vaults: [],
  selectedVaults: [],
  investAmount: 0,
  totalClaimBtc: 0,
  totalProfitBtc: 0,
  avgProfitPercent: 0,
  claimedDebtUnits: 0,
  depositBtc: 0,
  swapBtc: 0,
  userBtcInVault: 0,
  userUnitDebt: 0,
  loading: false,
  error: null,
  lastFetch: 0,
};

export const useLiquidationStore = create<LiquidationStore>()((set, get) => ({
  ...initialState,

  fetchVaults: async (btcPrice: number) => {
    set({ loading: true, error: null });

    try {
      const rawVaults = await fetchLiquidatableVaults();
      if (rawVaults.length === 0) {
        set({ rawVaults: [], vaults: [], loading: false, lastFetch: Date.now() });
        return;
      }

      // Map to display format with basic computed data
      const mapped = rawVaults.map(v => {
        const unit = v.stone.balance / 100;
        const btcInVault = v.output.amount / COIN_SIZE;
        const claimAmountBtc = btcInVault * 0.15; // Rough estimate until SDK profile
        const profitBtc = claimAmountBtc * 0.15;
        const unitSwapBtc = unit / btcPrice;

        return {
          vaultId: v.vault_id,
          unit,
          btcInVault,
          postTaxBtcInVault: btcInVault * 0.95,
          claimAmountBtc,
          unitSwapBtc,
          profitBtc,
          profitPercent: 15,
          profitPercentPrecised: 15,
        } as LiquidationVaultComputedData;
      });

      logger.debug('[LiquidationStore] Fetched vaults', { count: mapped.length });

      set({
        rawVaults,
        vaults: mapped,
        loading: false,
        lastFetch: Date.now(),
      });
    } catch (error: unknown) {
      logger.warn('[LiquidationStore] Failed to fetch vaults', {
        error: error instanceof Error ? error.message : String(error),
      });
      set({ loading: false, error: error instanceof Error ? error.message : 'Failed to fetch vaults' });
    }
  },

  setInvestAmount: (amount: number, btcPrice: number, _feeRate = 1) => {
    const { vaults } = get();

    if (amount <= 0 || vaults.length === 0) {
      set({
        investAmount: 0,
        selectedVaults: [],
        totalClaimBtc: 0,
        totalProfitBtc: 0,
        avgProfitPercent: 0,
        claimedDebtUnits: 0,
        depositBtc: 0,
        swapBtc: 0,
      });
      return;
    }

    // Simple proportional distribution across vaults
    const selected: LiquidationVaultComputedData[] = [];
    let remaining = amount;

    for (const vault of vaults) {
      if (remaining <= 0) break;

      const vaultClaimable = vault.claimAmountBtc;

      if (remaining >= vaultClaimable) {
        selected.push({ ...vault });
        remaining -= vaultClaimable;
      } else {
        // Partial claim on last vault
        const portion = remaining / vaultClaimable;
        selected.push({
          ...vault,
          claimAmountPartial: remaining,
          claimAmountDiff: vaultClaimable - remaining,
          profitBtc: vault.profitBtc * portion,
        });
        remaining = 0;
      }
    }

    // Compute aggregates
    const totalClaimBtc = selected.reduce((acc, v) => acc + (v.claimAmountPartial || v.claimAmountBtc), 0);
    const totalProfitBtc = selected.reduce((acc, v) => acc + v.profitBtc, 0);
    const depositBtc = amount * 0.32;
    const swapBtc = amount * 0.68;

    // Weighted average profit
    let weightedSum = 0;
    let weightTotal = 0;
    for (const v of selected) {
      const weight = v.claimAmountPartial || v.claimAmountBtc;
      weightedSum += v.profitPercent * weight;
      weightTotal += weight;
    }
    const avgProfitPercent = weightTotal > 0 ? weightedSum / weightTotal : 0;

    // Claimed debt units
    const claimedDebtUnits = selected.reduce((acc, v) => {
      const portion = v.claimAmountPartial ? v.claimAmountPartial / v.claimAmountBtc : 1;
      return acc + v.unit * portion;
    }, 0);

    set({
      investAmount: amount,
      selectedVaults: selected,
      totalClaimBtc,
      totalProfitBtc,
      avgProfitPercent,
      claimedDebtUnits,
      depositBtc,
      swapBtc,
    });
  },

  setUserVaultContext: (btcInVault: number, unitDebt: number) => {
    set({ userBtcInVault: btcInVault, userUnitDebt: unitDebt });
  },

  getMaxInvestable: (btcPrice: number) => {
    const { userBtcInVault, userUnitDebt, vaults } = get();
    if (!btcPrice || vaults.length === 0) return 0;

    const available = getAvailableCollateralBtc(btcPrice, userBtcInVault, userUnitDebt);
    const totalClaimable = vaults.reduce((acc, v) => acc + v.claimAmountBtc, 0);

    return Math.min(available, totalClaimable);
  },

  reset: () => set(initialState),
}));

// Individual selectors (stable references, no infinite re-renders)
export const useLiqVaults = () => useLiquidationStore((s) => s.vaults);
export const useLiqTotalProfitBtc = () => useLiquidationStore((s) => s.totalProfitBtc);
export const useLiqAvgProfitPercent = () => useLiquidationStore((s) => s.avgProfitPercent);
export const useLiqLoading = () => useLiquidationStore((s) => s.loading);
export const useLiqError = () => useLiquidationStore((s) => s.error);

// Action selectors (functions are stable references)
export const useLiqFetchVaults = () => useLiquidationStore((s) => s.fetchVaults);
export const useLiqSetInvestAmount = () => useLiquidationStore((s) => s.setInvestAmount);
export const useLiqSetUserVaultContext = () => useLiquidationStore((s) => s.setUserVaultContext);
export const useLiqGetMaxInvestable = () => useLiquidationStore((s) => s.getMaxInvestable);
export const useLiqReset = () => useLiquidationStore((s) => s.reset);
