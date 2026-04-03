/**
 * Deposit Store (Zustand)
 * Manages the deposit UI flow state for adding more BTC collateral to an existing vault
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
import {
  commonInitialState,
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
export type DepositStep = VaultOperationStep;
export type DepositProcessingStep = ProcessingStep;

/**
 * Deposit-specific state (extends common state)
 */
interface DepositSpecificState {
  // Form data
  depositAmountSats: number; // BTC to deposit in satoshis
  availableBalance: number; // Available BTC balance for deposit (in sats)
}

/**
 * Deposit-specific actions (extends common actions)
 */
interface DepositSpecificActions {
  // Form actions
  setDepositAmountSats: (amount: number) => void;
  setDepositAmountBtc: (amount: number) => void;
  setAvailableBalance: (balance: number) => void;

  // Deposit-specific computed getters
  getDepositAmountBtc: () => number;
  getTotalCollateral: () => number;
  getNewHealthFactor: () => number;
  getNewLiquidationPrice: () => number;
  getNewHealthStatus: () => HealthStatus;
}

// Full store types
type DepositState = CommonVaultState & DepositSpecificState;
type DepositActions = CommonVaultActions & DepositSpecificActions;
type DepositStore = DepositState & DepositActions;

// Deposit-specific initial state
const depositSpecificInitialState: DepositSpecificState = {
  depositAmountSats: 0,
  availableBalance: 0,
};

export const useDepositStore = create<DepositStore>()((set, get, store) => {
  // Get common slice
  const commonSlice = createCommonVaultSlice<DepositStore>({
    storeName: 'DepositStore',
  })(set, get, store);

  return {
    // Spread common state and actions
    ...commonSlice,

    // Deposit-specific initial state
    ...depositSpecificInitialState,

    // Deposit-specific form actions
    setDepositAmountSats: (depositAmountSats) => {
      logger.debug('[DepositStore] setDepositAmountSats:', depositAmountSats);
      set({ depositAmountSats, error: null });
    },

    setDepositAmountBtc: (btcAmount) => {
      const sats = Math.round(btcAmount * 100_000_000);
      logger.debug('[DepositStore] setDepositAmountBtc:', { btcAmount, sats });
      set({ depositAmountSats: sats, error: null });
    },

    setAvailableBalance: (availableBalance) => {
      logger.debug('[DepositStore] setAvailableBalance:', availableBalance);
      set({ availableBalance });
    },

    // Deposit-specific computed getters
    getDepositAmountBtc: () => {
      const { depositAmountSats } = get();
      return depositAmountSats / 100_000_000;
    },

    getTotalCollateral: () => {
      const { currentBtcLocked, depositAmountSats } = get();
      return currentBtcLocked + depositAmountSats / 100_000_000;
    },

    getNewHealthFactor: () => {
      const { depositAmountSats, currentBtcLocked, currentUnitBorrowed, bitcoinPrice } = get();
      const totalCollateral = currentBtcLocked + depositAmountSats / 100_000_000;
      if (!bitcoinPrice || totalCollateral <= 0 || currentUnitBorrowed <= 0) return 0;
      return computeHealthFactor(totalCollateral, bitcoinPrice, currentUnitBorrowed);
    },

    getNewLiquidationPrice: () => {
      const { depositAmountSats, currentBtcLocked, currentUnitBorrowed } = get();
      const totalCollateral = currentBtcLocked + depositAmountSats / 100_000_000;
      if (totalCollateral <= 0 || currentUnitBorrowed <= 0) return 0;
      return computeLiquidationPrice(currentUnitBorrowed, totalCollateral);
    },

    getNewHealthStatus: () => {
      const healthFactor = get().getNewHealthFactor();
      return getHealthStatus(healthFactor);
    },

    // Override reset to include deposit-specific state
    reset: () => {
      logger.debug('[DepositStore] reset');
      set({
        ...commonInitialState,
        ...depositSpecificInitialState,
      });
    },
  };
});

/**
 * useDeposit - Hook that returns commonly used state and actions
 * Uses individual selectors for reactive computed values
 */
export const useDeposit = () => {
  // Subscribe to primitive state values - these are reactive
  const depositAmountSats = useDepositStore((state) => state.depositAmountSats);
  const selectedFeeRate = useDepositStore((state) => state.selectedFeeRate);
  const currentUnitBorrowed = useDepositStore((state) => state.currentUnitBorrowed);
  const currentBtcLocked = useDepositStore((state) => state.currentBtcLocked);
  const bitcoinPrice = useDepositStore((state) => state.bitcoinPrice);
  const availableBalance = useDepositStore((state) => state.availableBalance);
  const currentStep = useDepositStore((state) => state.currentStep);
  const processingStep = useDepositStore((state) => state.processingStep);
  const loading = useDepositStore((state) => state.loading);
  const error = useDepositStore((state) => state.error);
  const vaultTxid = useDepositStore((state) => state.vaultTxid);

  // Subscribe to actions (stable references)
  const setDepositAmountSats = useDepositStore((state) => state.setDepositAmountSats);
  const setDepositAmountBtc = useDepositStore((state) => state.setDepositAmountBtc);
  const setSelectedFeeRate = useDepositStore((state) => state.setSelectedFeeRate);
  const setCurrentVaultData = useDepositStore((state) => state.setCurrentVaultData);
  const setBitcoinPrice = useDepositStore((state) => state.setBitcoinPrice);
  const setAvailableBalance = useDepositStore((state) => state.setAvailableBalance);
  const setCurrentStep = useDepositStore((state) => state.setCurrentStep);
  const setProcessingStep = useDepositStore((state) => state.setProcessingStep);
  const setLoading = useDepositStore((state) => state.setLoading);
  const setError = useDepositStore((state) => state.setError);
  const setVaultTxid = useDepositStore((state) => state.setVaultTxid);
  const reset = useDepositStore((state) => state.reset);

  // Compute derived values from reactive state
  const depositAmountBtc = depositAmountSats / 100_000_000;
  const availableBalanceBtc = availableBalance / 100_000_000;
  const totalCollateral = currentBtcLocked + depositAmountSats / 100_000_000;

  // Use helper functions for health calculations
  const { healthFactor, liquidationPrice, healthStatus } = computeVaultHealth(
    currentBtcLocked,
    currentUnitBorrowed,
    bitcoinPrice
  );

  const { newHealthFactor, newLiquidationPrice, newHealthStatus } = computeNewVaultHealth(
    totalCollateral,
    currentUnitBorrowed,
    bitcoinPrice
  );

  return {
    // State
    depositAmountSats,
    selectedFeeRate,
    currentUnitBorrowed,
    currentBtcLocked,
    bitcoinPrice,
    availableBalance,
    currentStep,
    processingStep,
    loading,
    error,
    vaultTxid,

    // Computed
    depositAmountBtc,
    availableBalanceBtc,
    totalCollateral,
    healthFactor,
    newHealthFactor,
    liquidationPrice,
    newLiquidationPrice,
    healthStatus,
    newHealthStatus,

    // Actions
    setDepositAmountSats,
    setDepositAmountBtc,
    setSelectedFeeRate,
    setCurrentVaultData,
    setBitcoinPrice,
    setAvailableBalance,
    setCurrentStep,
    setProcessingStep,
    setLoading,
    setError,
    setVaultTxid,
    reset,
  };
};
