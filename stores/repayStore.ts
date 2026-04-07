/**
 * Repay Store (Zustand)
 * Manages the repay UI flow state for paying back UNIT debt
 *
 * Built on createVaultOperationStore factory with repay-specific extensions
 */

import { logger } from '../utils/logger';
import {
  computeHealthFactor,
  computeLiquidationPrice,
  getHealthStatus,
  type HealthStatus,
} from '../utils/vaultUtils';
import {
  createVaultOperationStore,
  computeVaultHealth,
} from './vault';
import type {
  CommonVaultState,
  CommonVaultActions,
  VaultOperationStep,
  ProcessingStep,
} from './vault';

// Re-export types for backwards compatibility
export type RepayStep = VaultOperationStep;
export type RepayProcessingStep = ProcessingStep;

/**
 * Repay-specific state (extends common state)
 */
interface RepaySpecificState {
  // Form data
  repayAmountUnit: number; // UNIT to repay (in UNIT, not cents)
  availableUnitBalance: number; // Available UNIT balance for repay
  issueTxid: string | null;
}

/**
 * Repay-specific actions (extends common actions)
 */
interface RepaySpecificActions {
  // Form actions
  setRepayAmountUnit: (amount: number) => void;
  setAvailableUnitBalance: (balance: number) => void;
  setIssueTxid: (txid: string | null) => void;

  // Repay-specific computed getters
  getNewDebt: () => number;
  getNewHealthFactor: () => number;
  getNewLiquidationPrice: () => number;
  getNewHealthStatus: () => HealthStatus;
  getMaxRepayable: () => number;
}

// Combined repay extension type
type RepayExtension = RepaySpecificState & RepaySpecificActions;

// Repay-specific initial state
const repaySpecificInitialState: RepaySpecificState = {
  repayAmountUnit: 0,
  availableUnitBalance: 0,
  issueTxid: null,
};

export const useRepayStore = createVaultOperationStore<RepayExtension>(
  'repay',
  (set, get, { initialState }) => ({
    // Repay-specific initial state
    ...repaySpecificInitialState,

    // Repay-specific form actions
    setRepayAmountUnit: (repayAmountUnit: number) => {
      logger.debug('[RepayStore] setRepayAmountUnit:', repayAmountUnit);
      set({ repayAmountUnit, error: null } as Partial<CommonVaultState & CommonVaultActions & RepayExtension>);
    },

    setAvailableUnitBalance: (availableUnitBalance: number) => {
      logger.debug('[RepayStore] setAvailableUnitBalance:', availableUnitBalance);
      set({ availableUnitBalance } as Partial<CommonVaultState & CommonVaultActions & RepayExtension>);
    },

    setIssueTxid: (issueTxid: string | null) => {
      logger.debug('[RepayStore] setIssueTxid:', issueTxid);
      set({ issueTxid } as Partial<CommonVaultState & CommonVaultActions & RepayExtension>);
    },

    // Repay-specific computed getters
    getNewDebt: () => {
      const { currentUnitBorrowed, repayAmountUnit } = get();
      return Math.max(0, currentUnitBorrowed - repayAmountUnit);
    },

    getNewHealthFactor: () => {
      const { repayAmountUnit, currentBtcLocked, currentUnitBorrowed, bitcoinPrice } = get();
      const newDebt = Math.max(0, currentUnitBorrowed - repayAmountUnit);
      if (!bitcoinPrice || currentBtcLocked <= 0 || newDebt <= 0) return 999; // Max health when fully repaid
      return computeHealthFactor(currentBtcLocked, bitcoinPrice, newDebt);
    },

    getNewLiquidationPrice: () => {
      const { repayAmountUnit, currentBtcLocked, currentUnitBorrowed } = get();
      const newDebt = Math.max(0, currentUnitBorrowed - repayAmountUnit);
      if (currentBtcLocked <= 0) return 0;
      return computeLiquidationPrice(newDebt, currentBtcLocked);
    },

    getNewHealthStatus: () => {
      const healthFactor = get().getNewHealthFactor();
      return getHealthStatus(healthFactor);
    },

    getMaxRepayable: () => {
      const { currentUnitBorrowed, availableUnitBalance } = get();
      // Can only repay up to the debt amount or available balance, whichever is smaller
      return Math.min(currentUnitBorrowed, availableUnitBalance);
    },

    // Override reset to include repay-specific state
    reset: () => {
      logger.debug('[RepayStore] reset');
      set({
        ...initialState,
        ...repaySpecificInitialState,
      } as Partial<CommonVaultState & CommonVaultActions & RepayExtension>);
    },
  })
);

/**
 * useRepay - Hook that returns commonly used state and actions
 * Uses individual selectors for reactive computed values
 */
export const useRepay = () => {
  // Subscribe to primitive state values - these are reactive
  const repayAmountUnit = useRepayStore((state) => state.repayAmountUnit);
  const selectedFeeRate = useRepayStore((state) => state.selectedFeeRate);
  const currentUnitBorrowed = useRepayStore((state) => state.currentUnitBorrowed);
  const currentBtcLocked = useRepayStore((state) => state.currentBtcLocked);
  const bitcoinPrice = useRepayStore((state) => state.bitcoinPrice);
  const availableUnitBalance = useRepayStore((state) => state.availableUnitBalance);
  const currentStep = useRepayStore((state) => state.currentStep);
  const processingStep = useRepayStore((state) => state.processingStep);
  const loading = useRepayStore((state) => state.loading);
  const error = useRepayStore((state) => state.error);
  const issueTxid = useRepayStore((state) => state.issueTxid);
  const vaultTxid = useRepayStore((state) => state.vaultTxid);

  // Subscribe to actions (stable references)
  const setRepayAmountUnit = useRepayStore((state) => state.setRepayAmountUnit);
  const setSelectedFeeRate = useRepayStore((state) => state.setSelectedFeeRate);
  const setCurrentVaultData = useRepayStore((state) => state.setCurrentVaultData);
  const setBitcoinPrice = useRepayStore((state) => state.setBitcoinPrice);
  const setAvailableUnitBalance = useRepayStore((state) => state.setAvailableUnitBalance);
  const setCurrentStep = useRepayStore((state) => state.setCurrentStep);
  const setProcessingStep = useRepayStore((state) => state.setProcessingStep);
  const setLoading = useRepayStore((state) => state.setLoading);
  const setError = useRepayStore((state) => state.setError);
  const setIssueTxid = useRepayStore((state) => state.setIssueTxid);
  const setVaultTxid = useRepayStore((state) => state.setVaultTxid);
  const reset = useRepayStore((state) => state.reset);

  // Compute derived values from reactive state
  const newDebt = Math.max(0, currentUnitBorrowed - repayAmountUnit);

  // Use helper functions for health calculations
  const { healthFactor, liquidationPrice, healthStatus } = computeVaultHealth(
    currentBtcLocked,
    currentUnitBorrowed,
    bitcoinPrice
  );

  // Special case for repay: max health when fully repaid
  const newHealthFactor = (!bitcoinPrice || currentBtcLocked <= 0 || newDebt <= 0)
    ? 999 // Max health when fully repaid
    : computeHealthFactor(currentBtcLocked, bitcoinPrice, newDebt);

  const newLiquidationPrice = (currentBtcLocked <= 0)
    ? 0
    : computeLiquidationPrice(newDebt, currentBtcLocked);

  const newHealthStatus = getHealthStatus(newHealthFactor);

  // Can only repay up to the debt amount or available balance, whichever is smaller
  const maxRepayable = Math.min(currentUnitBorrowed, availableUnitBalance);

  return {
    // State
    repayAmountUnit,
    selectedFeeRate,
    currentUnitBorrowed,
    currentBtcLocked,
    bitcoinPrice,
    availableUnitBalance,
    currentStep,
    processingStep,
    loading,
    error,
    issueTxid,
    vaultTxid,

    // Computed
    newDebt,
    healthFactor,
    newHealthFactor,
    liquidationPrice,
    newLiquidationPrice,
    healthStatus,
    newHealthStatus,
    maxRepayable,

    // Actions
    setRepayAmountUnit,
    setSelectedFeeRate,
    setCurrentVaultData,
    setBitcoinPrice,
    setAvailableUnitBalance,
    setCurrentStep,
    setProcessingStep,
    setLoading,
    setError,
    setIssueTxid,
    setVaultTxid,
    reset,
  };
};
