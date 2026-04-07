/**
 * Borrow Store (Zustand)
 * Manages the borrow UI flow state for borrowing more UNIT from an existing vault
 *
 * Built on createVaultOperationStore factory with borrow-specific extensions
 */

import { logger } from '../utils/logger';
import {
  computeHealthFactor,
  computeLiquidationPrice,
  getMaxUnit,
  getHealthStatus,
  type HealthStatus,
} from '../utils/vaultUtils';
import {
  createVaultOperationStore,
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
export type BorrowStep = VaultOperationStep;
export type BorrowProcessingStep = ProcessingStep;

/**
 * Borrow-specific state (extends common state)
 */
interface BorrowSpecificState {
  // Form data
  borrowAmount: number; // Additional UNIT to borrow
  // Legacy field - some consumers may still use txid
  txid: string | null;
}

/**
 * Borrow-specific actions (extends common actions)
 */
interface BorrowSpecificActions {
  // Form actions
  setBorrowAmount: (amount: number) => void;

  // Legacy action for backwards compatibility
  setTxid: (txid: string | null, vaultTxid?: string | null) => void;

  // Borrow-specific computed getters
  getTotalDebt: () => number;
  getNewHealthFactor: () => number;
  getNewLiquidationPrice: () => number;
  getMaxBorrowable: () => number | null;
  getNewHealthStatus: () => HealthStatus;
}

// Combined borrow extension type
type BorrowExtension = BorrowSpecificState & BorrowSpecificActions;

// Borrow-specific initial state
const borrowSpecificInitialState: BorrowSpecificState = {
  borrowAmount: 0,
  txid: null,
};

export const useBorrowStore = createVaultOperationStore<BorrowExtension>(
  'borrow',
  (set, get, { initialState }) => ({
    // Borrow-specific initial state
    ...borrowSpecificInitialState,

    // Borrow-specific form actions
    setBorrowAmount: (borrowAmount: number) => {
      logger.debug('[BorrowStore] setBorrowAmount:', borrowAmount);
      set({ borrowAmount, error: null } as Partial<CommonVaultState & CommonVaultActions & BorrowExtension>);
    },

    // Legacy action for backwards compatibility
    setTxid: (txid: string | null, vaultTxid: string | null = null) => {
      logger.debug('[BorrowStore] setTxid:', { txid, vaultTxid });
      set({ txid, vaultTxid } as Partial<CommonVaultState & CommonVaultActions & BorrowExtension>);
    },

    // Borrow-specific computed getters
    getTotalDebt: () => {
      const { currentUnitBorrowed, borrowAmount } = get();
      return currentUnitBorrowed + borrowAmount;
    },

    getNewHealthFactor: () => {
      const { currentBtcLocked, borrowAmount, currentUnitBorrowed, bitcoinPrice } = get();
      const totalDebt = currentUnitBorrowed + borrowAmount;
      if (!bitcoinPrice || currentBtcLocked <= 0 || totalDebt <= 0) return 0;
      return computeHealthFactor(currentBtcLocked, bitcoinPrice, totalDebt);
    },

    getNewLiquidationPrice: () => {
      const { currentBtcLocked, borrowAmount, currentUnitBorrowed } = get();
      const totalDebt = currentUnitBorrowed + borrowAmount;
      if (currentBtcLocked <= 0 || totalDebt <= 0) return 0;
      return computeLiquidationPrice(totalDebt, currentBtcLocked);
    },

    getMaxBorrowable: () => {
      const { currentBtcLocked, currentUnitBorrowed, bitcoinPrice } = get();
      const maxTotal = getMaxUnit(currentBtcLocked, bitcoinPrice ?? undefined);
      if (maxTotal === null) return null;
      return Math.max(0, maxTotal - currentUnitBorrowed);
    },

    getNewHealthStatus: () => {
      const healthFactor = get().getNewHealthFactor();
      return getHealthStatus(healthFactor);
    },

    // Override reset to include borrow-specific state
    reset: () => {
      logger.debug('[BorrowStore] reset');
      set({
        ...initialState,
        ...borrowSpecificInitialState,
      } as Partial<CommonVaultState & CommonVaultActions & BorrowExtension>);
    },
  })
);

/**
 * useBorrow - Hook that returns commonly used state and actions
 * Uses individual selectors for reactive computed values
 */
export const useBorrow = () => {
  // Subscribe to primitive state values - these are reactive
  const borrowAmount = useBorrowStore((state) => state.borrowAmount);
  const selectedFeeRate = useBorrowStore((state) => state.selectedFeeRate);
  const currentUnitBorrowed = useBorrowStore((state) => state.currentUnitBorrowed);
  const currentBtcLocked = useBorrowStore((state) => state.currentBtcLocked);
  const bitcoinPrice = useBorrowStore((state) => state.bitcoinPrice);
  const currentStep = useBorrowStore((state) => state.currentStep);
  const processingStep = useBorrowStore((state) => state.processingStep);
  const loading = useBorrowStore((state) => state.loading);
  const error = useBorrowStore((state) => state.error);
  const txid = useBorrowStore((state) => state.txid);
  const vaultTxid = useBorrowStore((state) => state.vaultTxid);

  // Subscribe to actions (stable references)
  const setBorrowAmount = useBorrowStore((state) => state.setBorrowAmount);
  const setSelectedFeeRate = useBorrowStore((state) => state.setSelectedFeeRate);
  const setCurrentVaultData = useBorrowStore((state) => state.setCurrentVaultData);
  const setBitcoinPrice = useBorrowStore((state) => state.setBitcoinPrice);
  const setCurrentStep = useBorrowStore((state) => state.setCurrentStep);
  const setProcessingStep = useBorrowStore((state) => state.setProcessingStep);
  const setLoading = useBorrowStore((state) => state.setLoading);
  const setError = useBorrowStore((state) => state.setError);
  const setTxid = useBorrowStore((state) => state.setTxid);
  const reset = useBorrowStore((state) => state.reset);

  // Compute derived values from reactive state
  const totalDebt = currentUnitBorrowed + borrowAmount;

  // Use helper functions for health calculations
  const { healthFactor, liquidationPrice, healthStatus } = computeVaultHealth(
    currentBtcLocked,
    currentUnitBorrowed,
    bitcoinPrice
  );

  const { newHealthFactor, newLiquidationPrice, newHealthStatus } = computeNewVaultHealth(
    currentBtcLocked,
    totalDebt,
    bitcoinPrice
  );

  const maxTotal = getMaxUnit(currentBtcLocked, bitcoinPrice ?? undefined);
  const maxBorrowable = maxTotal !== null ? Math.max(0, maxTotal - currentUnitBorrowed) : null;

  return {
    // State
    borrowAmount,
    selectedFeeRate,
    currentUnitBorrowed,
    currentBtcLocked,
    bitcoinPrice,
    currentStep,
    processingStep,
    loading,
    error,
    txid,
    vaultTxid,

    // Computed
    totalDebt,
    healthFactor,
    newHealthFactor,
    liquidationPrice,
    newLiquidationPrice,
    maxBorrowable,
    healthStatus,
    newHealthStatus,

    // Actions
    setBorrowAmount,
    setSelectedFeeRate,
    setCurrentVaultData,
    setBitcoinPrice,
    setCurrentStep,
    setProcessingStep,
    setLoading,
    setError,
    setTxid,
    reset,
  };
};
