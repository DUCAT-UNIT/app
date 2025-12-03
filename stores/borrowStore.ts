/**
 * Borrow Store (Zustand)
 * Manages the borrow UI flow state for borrowing more UNIT from an existing vault
 */

import { create } from 'zustand';
import { logger } from '../utils/logger';
import {
  computeHealthFactor,
  computeLiquidationPrice,
  getMaxUnit,
  getHealthStatus,
  type HealthStatus,
} from '../utils/vaultUtils';

export type BorrowStep =
  | 'input' // Step 1: Enter UNIT borrow amount
  | 'confirm' // Step 2: Review and confirm
  | 'processing' // Step 3: Transaction in progress
  | 'success'; // Step 4: Transaction complete

export type BorrowProcessingStep = 1 | 2 | 3 | 4;
// 1: Awaiting user signatures
// 2: Request received by node
// 3: Validation in progress
// 4: Network approvals

interface BorrowState {
  // Form data
  borrowAmount: number; // Additional UNIT to borrow
  selectedFeeRate: number;

  // Current vault data
  currentUnitBorrowed: number; // Current UNIT debt in vault
  currentBtcLocked: number; // Current BTC locked in vault
  bitcoinPrice: number | null;

  // Process state
  currentStep: BorrowStep;
  processingStep: BorrowProcessingStep;
  loading: boolean;
  error: string | null;
  txid: string | null;
  vaultTxid: string | null;
}

interface BorrowActions {
  // Form actions
  setBorrowAmount: (amount: number) => void;
  setSelectedFeeRate: (rate: number) => void;

  // Vault data actions
  setCurrentVaultData: (unitBorrowed: number, btcLocked: number) => void;
  setBitcoinPrice: (price: number | null) => void;

  // Navigation
  setCurrentStep: (step: BorrowStep) => void;
  setProcessingStep: (step: BorrowProcessingStep) => void;

  // Process actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTxid: (txid: string | null, vaultTxid?: string | null) => void;

  // Computed getters
  getTotalDebt: () => number;
  getHealthFactor: () => number;
  getNewHealthFactor: () => number;
  getLiquidationPrice: () => number;
  getNewLiquidationPrice: () => number;
  getMaxBorrowable: () => number | null;
  getHealthStatus: () => HealthStatus;
  getNewHealthStatus: () => HealthStatus;

  // Reset
  reset: () => void;
}

type BorrowStore = BorrowState & BorrowActions;

const initialState: BorrowState = {
  borrowAmount: 0,
  selectedFeeRate: 1,
  currentUnitBorrowed: 0,
  currentBtcLocked: 0,
  bitcoinPrice: null,
  currentStep: 'input',
  processingStep: 1,
  loading: false,
  error: null,
  txid: null,
  vaultTxid: null,
};

export const useBorrowStore = create<BorrowStore>((set, get) => ({
  // Initial state
  ...initialState,

  // Form actions
  setBorrowAmount: (borrowAmount) => {
    logger.debug('[BorrowStore] setBorrowAmount:', borrowAmount);
    set({ borrowAmount, error: null });
  },

  setSelectedFeeRate: (selectedFeeRate) => {
    logger.debug('[BorrowStore] setSelectedFeeRate:', selectedFeeRate);
    set({ selectedFeeRate });
  },

  // Vault data actions
  setCurrentVaultData: (unitBorrowed, btcLocked) => {
    logger.debug('[BorrowStore] setCurrentVaultData:', { unitBorrowed, btcLocked });
    set({
      currentUnitBorrowed: unitBorrowed,
      currentBtcLocked: btcLocked,
    });
  },

  setBitcoinPrice: (bitcoinPrice) => {
    set({ bitcoinPrice });
  },

  // Navigation
  setCurrentStep: (currentStep) => {
    logger.debug('[BorrowStore] setCurrentStep:', currentStep);
    set({ currentStep, error: null });
  },

  setProcessingStep: (processingStep) => {
    logger.debug('[BorrowStore] setProcessingStep:', processingStep);
    set({ processingStep });
  },

  // Process actions
  setLoading: (loading) => set({ loading }),

  setError: (error) => {
    logger.debug('[BorrowStore] setError:', error);
    set({ error, loading: false });
  },

  setTxid: (txid, vaultTxid = null) => {
    logger.debug('[BorrowStore] setTxid:', { txid, vaultTxid });
    set({ txid, vaultTxid });
  },

  // Computed getters
  getTotalDebt: () => {
    const { currentUnitBorrowed, borrowAmount } = get();
    return currentUnitBorrowed + borrowAmount;
  },

  getHealthFactor: () => {
    const { currentBtcLocked, currentUnitBorrowed, bitcoinPrice } = get();
    if (!bitcoinPrice || currentBtcLocked <= 0 || currentUnitBorrowed <= 0) return 0;
    return computeHealthFactor(currentBtcLocked, bitcoinPrice, currentUnitBorrowed);
  },

  getNewHealthFactor: () => {
    const { currentBtcLocked, borrowAmount, currentUnitBorrowed, bitcoinPrice } = get();
    const totalDebt = currentUnitBorrowed + borrowAmount;
    if (!bitcoinPrice || currentBtcLocked <= 0 || totalDebt <= 0) return 0;
    return computeHealthFactor(currentBtcLocked, bitcoinPrice, totalDebt);
  },

  getLiquidationPrice: () => {
    const { currentBtcLocked, currentUnitBorrowed } = get();
    if (currentBtcLocked <= 0 || currentUnitBorrowed <= 0) return 0;
    return computeLiquidationPrice(currentUnitBorrowed, currentBtcLocked);
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

  getHealthStatus: () => {
    const healthFactor = get().getHealthFactor();
    return getHealthStatus(healthFactor);
  },

  getNewHealthStatus: () => {
    const healthFactor = get().getNewHealthFactor();
    return getHealthStatus(healthFactor);
  },

  // Reset
  reset: () => {
    logger.debug('[BorrowStore] reset');
    set(initialState);
  },
}));

/**
 * Selector hooks for granular subscriptions
 */
export const useBorrowAmount = () => useBorrowStore((state) => state.borrowAmount);
export const useCurrentStep = () => useBorrowStore((state) => state.currentStep);
export const useProcessingStep = () => useBorrowStore((state) => state.processingStep);
export const useBorrowLoading = () => useBorrowStore((state) => state.loading);
export const useBorrowError = () => useBorrowStore((state) => state.error);
export const useBorrowTxid = () => useBorrowStore((state) => state.txid);

/**
 * Reset store to initial state (useful for testing)
 */
export const resetBorrowStore = () => {
  useBorrowStore.setState(initialState);
};

/**
 * useBorrow - Hook that returns commonly used state and actions
 */
export const useBorrow = () => {
  const store = useBorrowStore();
  return {
    // State
    borrowAmount: store.borrowAmount,
    selectedFeeRate: store.selectedFeeRate,
    currentUnitBorrowed: store.currentUnitBorrowed,
    currentBtcLocked: store.currentBtcLocked,
    bitcoinPrice: store.bitcoinPrice,
    currentStep: store.currentStep,
    processingStep: store.processingStep,
    loading: store.loading,
    error: store.error,
    txid: store.txid,
    vaultTxid: store.vaultTxid,

    // Computed
    totalDebt: store.getTotalDebt(),
    healthFactor: store.getHealthFactor(),
    newHealthFactor: store.getNewHealthFactor(),
    liquidationPrice: store.getLiquidationPrice(),
    newLiquidationPrice: store.getNewLiquidationPrice(),
    maxBorrowable: store.getMaxBorrowable(),
    healthStatus: store.getHealthStatus(),
    newHealthStatus: store.getNewHealthStatus(),

    // Actions
    setBorrowAmount: store.setBorrowAmount,
    setSelectedFeeRate: store.setSelectedFeeRate,
    setCurrentVaultData: store.setCurrentVaultData,
    setBitcoinPrice: store.setBitcoinPrice,
    setCurrentStep: store.setCurrentStep,
    setProcessingStep: store.setProcessingStep,
    setLoading: store.setLoading,
    setError: store.setError,
    setTxid: store.setTxid,
    reset: store.reset,
  };
};
