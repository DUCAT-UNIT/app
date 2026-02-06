/**
 * Withdraw Store (Zustand)
 * Manages the withdraw UI flow state for withdrawing BTC collateral from an existing vault
 *
 * Refactored to use common vault store pattern from stores/vault/
 */

import { create } from 'zustand';
import { logger } from '../utils/logger';
import {
  computeHealthFactor,
  computeLiquidationPrice,
  getHealthStatus,
  type HealthStatus,
} from '../utils/vaultUtils';
import { VAULT_CONFIG } from '../utils/constants';
import {
  createCommonVaultSlice,
  computeVaultHealth,
  computeNewVaultHealth,
} from './vault';
import type {
  CommonVaultState,
  CommonVaultActions,
  VaultOperationStep,
  ProcessingStep,
} from './vault';

// Re-export types for backwards compatibility
export type WithdrawStep = VaultOperationStep;
export type WithdrawProcessingStep = ProcessingStep;

/**
 * Withdraw-specific state (extends common state)
 */
interface WithdrawSpecificState {
  // Form data
  withdrawAmountSats: number; // BTC to withdraw in satoshis
}

/**
 * Withdraw-specific actions (extends common actions)
 */
interface WithdrawSpecificActions {
  // Form actions
  setWithdrawAmountSats: (amount: number) => void;
  setWithdrawAmountBtc: (amount: number) => void;

  // Withdraw-specific computed getters
  getWithdrawAmountBtc: () => number;
  getNewCollateral: () => number;
  getNewHealthFactor: () => number;
  getNewLiquidationPrice: () => number;
  getNewHealthStatus: () => HealthStatus;
  getMaxWithdrawable: () => number; // Max BTC that can be withdrawn while maintaining min health
}

// Full store types
type WithdrawState = CommonVaultState & WithdrawSpecificState;
type WithdrawActions = CommonVaultActions & WithdrawSpecificActions;
type WithdrawStore = WithdrawState & WithdrawActions;

// Withdraw-specific initial state
const withdrawSpecificInitialState: WithdrawSpecificState = {
  withdrawAmountSats: 0,
};

export const useWithdrawStore = create<WithdrawStore>()((set, get, store) => {
  // Get common slice
  const commonSlice = createCommonVaultSlice<WithdrawStore>({
    storeName: 'WithdrawStore',
  })(set, get, store);

  return {
    // Spread common state and actions
    ...commonSlice,

    // Withdraw-specific initial state
    ...withdrawSpecificInitialState,

    // Withdraw-specific form actions
    setWithdrawAmountSats: (withdrawAmountSats) => {
      logger.debug('[WithdrawStore] setWithdrawAmountSats:', withdrawAmountSats);
      set({ withdrawAmountSats, error: null });
    },

    setWithdrawAmountBtc: (btcAmount) => {
      const sats = Math.round(btcAmount * 100_000_000);
      logger.debug('[WithdrawStore] setWithdrawAmountBtc:', { btcAmount, sats });
      set({ withdrawAmountSats: sats, error: null });
    },

    // Withdraw-specific computed getters
    getWithdrawAmountBtc: () => {
      const { withdrawAmountSats } = get();
      return withdrawAmountSats / 100_000_000;
    },

    getNewCollateral: () => {
      const { currentBtcLocked, withdrawAmountSats } = get();
      return Math.max(0, currentBtcLocked - withdrawAmountSats / 100_000_000);
    },

    getNewHealthFactor: () => {
      const { withdrawAmountSats, currentBtcLocked, currentUnitBorrowed, bitcoinPrice } = get();
      const newCollateral = currentBtcLocked - withdrawAmountSats / 100_000_000;
      if (!bitcoinPrice || newCollateral <= 0 || currentUnitBorrowed <= 0) return 0;
      return computeHealthFactor(newCollateral, bitcoinPrice, currentUnitBorrowed);
    },

    getNewLiquidationPrice: () => {
      const { withdrawAmountSats, currentBtcLocked, currentUnitBorrowed } = get();
      const newCollateral = currentBtcLocked - withdrawAmountSats / 100_000_000;
      if (newCollateral <= 0 || currentUnitBorrowed <= 0) return 0;
      return computeLiquidationPrice(currentUnitBorrowed, newCollateral);
    },

    getNewHealthStatus: () => {
      const healthFactor = get().getNewHealthFactor();
      return getHealthStatus(healthFactor);
    },

    getMaxWithdrawable: () => {
      const { currentBtcLocked, currentUnitBorrowed, bitcoinPrice } = get();
      if (!bitcoinPrice || currentBtcLocked <= 0 || currentUnitBorrowed <= 0) return 0;

      // Calculate min collateral needed to maintain MIN_COL_RATE (160%)
      // health = (collateral * btcPrice) / debt * 100
      // minCollateral * btcPrice / debt * 100 = MIN_COL_RATE * 100
      // minCollateral = (MIN_COL_RATE * 100 * debt) / (btcPrice * 100)
      const minHealthRatio = VAULT_CONFIG.MIN_COL_RATE * 100;
      const minCollateral = (minHealthRatio * currentUnitBorrowed) / (bitcoinPrice * 100);

      // Max withdrawable is current - minimum (in sats)
      const maxWithdrawableBtc = Math.max(0, currentBtcLocked - minCollateral);
      return Math.floor(maxWithdrawableBtc * 100_000_000);
    },

    // Override reset to include withdraw-specific state
    reset: () => {
      logger.debug('[WithdrawStore] reset');
      set({
        ...withdrawSpecificInitialState,
        // Reset common state
        selectedFeeRate: 1,
        currentUnitBorrowed: 0,
        currentBtcLocked: 0,
        bitcoinPrice: null,
        currentStep: 'input',
        processingStep: 1,
        loading: false,
        error: null,
        vaultTxid: null,
      });
    },
  };
});

/**
 * Selector hooks for granular subscriptions
 */
export const useWithdrawAmountSats = () => useWithdrawStore((state) => state.withdrawAmountSats);
export const useWithdrawCurrentStep = () => useWithdrawStore((state) => state.currentStep);
export const useWithdrawProcessingStep = () => useWithdrawStore((state) => state.processingStep);
export const useWithdrawLoading = () => useWithdrawStore((state) => state.loading);
export const useWithdrawError = () => useWithdrawStore((state) => state.error);
export const useWithdrawVaultTxid = () => useWithdrawStore((state) => state.vaultTxid);

/**
 * Reset store to initial state (useful for testing)
 */
export const resetWithdrawStore = () => {
  useWithdrawStore.getState().reset();
};

/**
 * useWithdraw - Hook that returns commonly used state and actions
 * Uses individual selectors for reactive computed values
 */
export const useWithdraw = () => {
  // Subscribe to primitive state values - these are reactive
  const withdrawAmountSats = useWithdrawStore((state) => state.withdrawAmountSats);
  const selectedFeeRate = useWithdrawStore((state) => state.selectedFeeRate);
  const currentUnitBorrowed = useWithdrawStore((state) => state.currentUnitBorrowed);
  const currentBtcLocked = useWithdrawStore((state) => state.currentBtcLocked);
  const bitcoinPrice = useWithdrawStore((state) => state.bitcoinPrice);
  const currentStep = useWithdrawStore((state) => state.currentStep);
  const processingStep = useWithdrawStore((state) => state.processingStep);
  const loading = useWithdrawStore((state) => state.loading);
  const error = useWithdrawStore((state) => state.error);
  const vaultTxid = useWithdrawStore((state) => state.vaultTxid);

  // Subscribe to actions (stable references)
  const setWithdrawAmountSats = useWithdrawStore((state) => state.setWithdrawAmountSats);
  const setWithdrawAmountBtc = useWithdrawStore((state) => state.setWithdrawAmountBtc);
  const setSelectedFeeRate = useWithdrawStore((state) => state.setSelectedFeeRate);
  const setCurrentVaultData = useWithdrawStore((state) => state.setCurrentVaultData);
  const setBitcoinPrice = useWithdrawStore((state) => state.setBitcoinPrice);
  const setCurrentStep = useWithdrawStore((state) => state.setCurrentStep);
  const setProcessingStep = useWithdrawStore((state) => state.setProcessingStep);
  const setLoading = useWithdrawStore((state) => state.setLoading);
  const setError = useWithdrawStore((state) => state.setError);
  const setVaultTxid = useWithdrawStore((state) => state.setVaultTxid);
  const reset = useWithdrawStore((state) => state.reset);

  // Compute derived values from reactive state
  const withdrawAmountBtc = withdrawAmountSats / 100_000_000;
  const newCollateral = Math.max(0, currentBtcLocked - withdrawAmountSats / 100_000_000);

  // Use helper functions for health calculations
  const { healthFactor, liquidationPrice, healthStatus } = computeVaultHealth(
    currentBtcLocked,
    currentUnitBorrowed,
    bitcoinPrice
  );

  const { newHealthFactor, newLiquidationPrice, newHealthStatus } = computeNewVaultHealth(
    newCollateral,
    currentUnitBorrowed,
    bitcoinPrice
  );

  // Calculate max withdrawable
  let maxWithdrawable = 0;
  if (bitcoinPrice && currentBtcLocked > 0 && currentUnitBorrowed > 0) {
    const minHealthRatio = VAULT_CONFIG.MIN_COL_RATE * 100;
    const minCollateral = (minHealthRatio * currentUnitBorrowed) / (bitcoinPrice * 100);
    const maxWithdrawableBtc = Math.max(0, currentBtcLocked - minCollateral);
    maxWithdrawable = Math.floor(maxWithdrawableBtc * 100_000_000);
  }

  return {
    // State
    withdrawAmountSats,
    selectedFeeRate,
    currentUnitBorrowed,
    currentBtcLocked,
    bitcoinPrice,
    currentStep,
    processingStep,
    loading,
    error,
    vaultTxid,

    // Computed
    withdrawAmountBtc,
    newCollateral,
    healthFactor,
    newHealthFactor,
    liquidationPrice,
    newLiquidationPrice,
    healthStatus,
    newHealthStatus,
    maxWithdrawable,

    // Actions
    setWithdrawAmountSats,
    setWithdrawAmountBtc,
    setSelectedFeeRate,
    setCurrentVaultData,
    setBitcoinPrice,
    setCurrentStep,
    setProcessingStep,
    setLoading,
    setError,
    setVaultTxid,
    reset,
  };
};
