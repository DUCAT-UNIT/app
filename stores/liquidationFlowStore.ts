/**
 * Liquidation Flow Store (Zustand)
 * Manages the liquidation UI flow state (input → review → processing → success/error)
 *
 * NOT persisted — all fields are transient UI state for a short-lived flow.
 * Standalone store (not using createCommonVaultSlice) because liquidation's
 * step machine differs from vault operations (has 'review', no 'confirm').
 */

import { create } from 'zustand';
import type { LiqVaultDisplay, LiquidVaultProfileWithMeta } from '../services/liquidation/types';

// ============================================================
// Types
// ============================================================

export type LiquidationStep = 'input' | 'review' | 'processing' | 'success' | 'error';
export type LiquidationFetchStatus = 'idle' | 'loading' | 'loaded' | 'error';
export type LiquidationReviewTab = 'overview' | 'howItWorks';

interface LiquidationFlowState {
  currentStep: LiquidationStep;
  fetchStatus: LiquidationFetchStatus;
  investAmount: number;
  showBTC: boolean;
  reviewTab: LiquidationReviewTab;
  vaultExpanded: boolean;
  processingMessage: string;
  resultTxid: string | null;
  resultSwapTxid: string | null;
  error: string | null;
  vaults: LiqVaultDisplay[];
  vaultsFull: LiquidVaultProfileWithMeta[];
  isExecuting: boolean;
  executingVaultIds: string[];
  suppressedVaultIds: string[];
  profitRate: number;
  depositRate: number;
  swapRate: number;
}

interface LiquidationFlowActions {
  setCurrentStep: (step: LiquidationStep) => void;
  setFetchStatus: (status: LiquidationFetchStatus) => void;
  setInvestAmount: (amount: number) => void;
  setShowBTC: (show: boolean) => void;
  setReviewTab: (tab: LiquidationReviewTab) => void;
  setVaultExpanded: (expanded: boolean) => void;
  setProcessingMessage: (message: string) => void;
  setResultTxid: (txid: string | null) => void;
  setResultSwapTxid: (txid: string | null) => void;
  setError: (error: string | null) => void;
  beginExecution: (vaultIds: string[]) => boolean;
  completeExecution: () => void;
  markVaultsClaimed: (vaultIds: string[]) => void;
  releaseVaults: (vaultIds: string[]) => void;
  removeVaultsByIds: (vaultIds: string[]) => void;
  setVaultData: (
    display: LiqVaultDisplay[],
    full: LiquidVaultProfileWithMeta[],
    profitRate: number,
    depositRate: number,
    swapRate: number,
  ) => void;
  reset: () => void;
}

type LiquidationFlowStore = LiquidationFlowState & LiquidationFlowActions;

// ============================================================
// Initial State
// ============================================================

const initialState: LiquidationFlowState = {
  currentStep: 'input',
  fetchStatus: 'idle',
  investAmount: 0,
  showBTC: false,
  reviewTab: 'overview',
  vaultExpanded: false,
  processingMessage: 'Preparing liquidation...',
  resultTxid: null,
  resultSwapTxid: null,
  error: null,
  vaults: [],
  vaultsFull: [],
  isExecuting: false,
  executingVaultIds: [],
  suppressedVaultIds: [],
  profitRate: 0,
  depositRate: 0,
  swapRate: 0,
};

// ============================================================
// Store
// ============================================================

export const useLiquidationFlowStore = create<LiquidationFlowStore>((set) => ({
  ...initialState,

  setCurrentStep: (step) => set({ currentStep: step }),
  setFetchStatus: (status) => set({ fetchStatus: status }),
  setInvestAmount: (amount) => set({ investAmount: amount }),
  setShowBTC: (show) => set({ showBTC: show }),
  setReviewTab: (tab) => set({ reviewTab: tab }),
  setVaultExpanded: (expanded) => set({ vaultExpanded: expanded }),
  setProcessingMessage: (message) => set({ processingMessage: message }),
  setResultTxid: (txid) => set({ resultTxid: txid }),
  setResultSwapTxid: (txid) => set({ resultSwapTxid: txid }),
  setError: (error) => set({ error: error }),
  beginExecution: (vaultIds) => {
    let acquired = false;
    set((state) => {
      if (state.isExecuting) {
        return state;
      }
      acquired = true;
      const uniqueIds = Array.from(new Set(vaultIds.filter(Boolean)));
      return {
        isExecuting: true,
        executingVaultIds: uniqueIds,
      };
    });
    return acquired;
  },
  completeExecution: () => set({ isExecuting: false, executingVaultIds: [] }),
  markVaultsClaimed: (vaultIds) =>
    set((state) => {
      const claimed = new Set(vaultIds.filter(Boolean));
      const suppressed = new Set([...state.suppressedVaultIds, ...claimed]);
      return {
        isExecuting: false,
        executingVaultIds: [],
        suppressedVaultIds: [...suppressed],
        vaults: state.vaults.filter((vault) => !claimed.has(vault.vaultId)),
        vaultsFull: state.vaultsFull.filter((vault) => !claimed.has(vault.vaultId)),
      };
    }),
  releaseVaults: (vaultIds) =>
    set((state) => {
      const released = new Set(vaultIds.filter(Boolean));
      return {
        isExecuting: false,
        executingVaultIds: state.executingVaultIds.filter((id) => !released.has(id)),
        suppressedVaultIds: state.suppressedVaultIds.filter((id) => !released.has(id)),
      };
    }),
  removeVaultsByIds: (vaultIds) =>
    set((state) => {
      const removed = new Set(vaultIds.filter(Boolean));
      if (removed.size === 0) {
        return state;
      }
      return {
        vaults: state.vaults.filter((vault) => !removed.has(vault.vaultId)),
        vaultsFull: state.vaultsFull.filter((vault) => !removed.has(vault.vaultId)),
        executingVaultIds: state.executingVaultIds.filter((id) => !removed.has(id)),
        suppressedVaultIds: state.suppressedVaultIds.filter((id) => !removed.has(id)),
      };
    }),
  setVaultData: (display, full, profitRate, depositRate, swapRate) =>
    set((state) => {
      const suppressed = new Set([...state.suppressedVaultIds, ...state.executingVaultIds]);
      return {
        vaults: display.filter((vault) => !suppressed.has(vault.vaultId)),
        vaultsFull: full.filter((vault) => !suppressed.has(vault.vaultId)),
        profitRate,
        depositRate,
        swapRate,
      };
    }),
  reset: () =>
    set((state) => ({
      ...initialState,
      suppressedVaultIds: state.suppressedVaultIds,
    })),
}));

// ============================================================
// Selector Hooks (avoid object reference instability)
// ============================================================

export const useLiqStep = () => useLiquidationFlowStore((s) => s.currentStep);
export const useLiqFetchStatus = () => useLiquidationFlowStore((s) => s.fetchStatus);
export const useLiqInvestAmount = () => useLiquidationFlowStore((s) => s.investAmount);
export const useLiqShowBTC = () => useLiquidationFlowStore((s) => s.showBTC);
export const useLiqReviewTab = () => useLiquidationFlowStore((s) => s.reviewTab);
export const useLiqVaultExpanded = () => useLiquidationFlowStore((s) => s.vaultExpanded);
export const useLiqProcessingMsg = () => useLiquidationFlowStore((s) => s.processingMessage);
export const useLiqResultTxid = () => useLiquidationFlowStore((s) => s.resultTxid);
export const useLiqResultSwapTxid = () => useLiquidationFlowStore((s) => s.resultSwapTxid);
export const useLiqError = () => useLiquidationFlowStore((s) => s.error);
export const useLiqVaults = () => useLiquidationFlowStore((s) => s.vaults);
export const useLiqVaultsFull = () => useLiquidationFlowStore((s) => s.vaultsFull);
export const useLiqIsExecuting = () => useLiquidationFlowStore((s) => s.isExecuting);
export const useLiqProfitRate = () => useLiquidationFlowStore((s) => s.profitRate);
export const useLiqDepositRate = () => useLiquidationFlowStore((s) => s.depositRate);
export const useLiqSwapRate = () => useLiquidationFlowStore((s) => s.swapRate);

// Reset store (for testing)
export const resetLiquidationFlowStore = (): void => {
  useLiquidationFlowStore.setState(initialState);
};
