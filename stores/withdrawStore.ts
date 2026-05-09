/**
 * Withdraw Store (Zustand)
 * Manages the withdraw UI flow state for withdrawing BTC collateral from an existing vault
 *
 * Built on createVaultOperationStore factory with withdraw-specific extensions
 */

import { logger } from '../utils/logger';
import {
  computeHealthFactor,
  computeLiquidationPrice,
  getOpCostWithdraw,
  getHealthStatus,
  type HealthStatus,
} from '../utils/vaultUtils';
import { VAULT_CONFIG } from '../utils/constants';
import { createVaultOperationStore, computeVaultHealth, computeNewVaultHealth } from './vault';
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

// Combined withdraw extension type
type WithdrawExtension = WithdrawSpecificState & WithdrawSpecificActions;

// Withdraw-specific initial state
const withdrawSpecificInitialState: WithdrawSpecificState = {
  withdrawAmountSats: 0,
};

interface MaxWithdrawableParams {
  currentBtcLocked: number;
  currentUnitBorrowed: number;
  bitcoinPrice: number | null;
  selectedFeeRate: number;
}

export function calculateMaxWithdrawableSats({
  currentBtcLocked,
  currentUnitBorrowed,
  bitcoinPrice,
  selectedFeeRate,
}: MaxWithdrawableParams): number {
  if (currentBtcLocked <= 0) return 0;

  const currentVaultSats = Math.floor(currentBtcLocked * 100_000_000);
  const withdrawFeeSats = getOpCostWithdraw(selectedFeeRate);

  if (currentUnitBorrowed <= 0) {
    return Math.max(0, currentVaultSats - withdrawFeeSats - VAULT_CONFIG.MIN_VAULT_BALANCE);
  }

  if (!bitcoinPrice) return 0;

  const minCollateralBtc = (VAULT_CONFIG.MIN_COL_RATE * currentUnitBorrowed) / bitcoinPrice;
  const minCollateralSats = Math.ceil(minCollateralBtc * 100_000_000);
  const minimumRemainingVaultSats = Math.max(minCollateralSats, VAULT_CONFIG.MIN_VAULT_BALANCE);

  return Math.max(0, currentVaultSats - minimumRemainingVaultSats - withdrawFeeSats);
}

export const useWithdrawStore = createVaultOperationStore<WithdrawExtension>(
  'withdraw',
  (set, get, { initialState }) => ({
    // Withdraw-specific initial state
    ...withdrawSpecificInitialState,

    // Withdraw-specific form actions
    setWithdrawAmountSats: (withdrawAmountSats: number) => {
      logger.debug('[WithdrawStore] setWithdrawAmountSats:', withdrawAmountSats);
      set({ withdrawAmountSats, error: null } as Partial<
        CommonVaultState & CommonVaultActions & WithdrawExtension
      >);
    },

    setWithdrawAmountBtc: (btcAmount: number) => {
      const sats = Math.round(btcAmount * 100_000_000);
      logger.debug('[WithdrawStore] setWithdrawAmountBtc:', { btcAmount, sats });
      set({ withdrawAmountSats: sats, error: null } as Partial<
        CommonVaultState & CommonVaultActions & WithdrawExtension
      >);
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
      const { currentBtcLocked, currentUnitBorrowed, bitcoinPrice, selectedFeeRate } = get();
      return calculateMaxWithdrawableSats({
        currentBtcLocked,
        currentUnitBorrowed,
        bitcoinPrice,
        selectedFeeRate,
      });
    },

    // Override reset to include withdraw-specific state
    reset: () => {
      logger.debug('[WithdrawStore] reset');
      set({
        ...initialState,
        ...withdrawSpecificInitialState,
      } as Partial<CommonVaultState & CommonVaultActions & WithdrawExtension>);
    },
  })
);

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

  // Calculate max withdrawable (delegates to store getter to avoid duplication)
  const maxWithdrawable = useWithdrawStore.getState().getMaxWithdrawable();

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
