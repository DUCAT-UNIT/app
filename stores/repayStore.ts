/**
 * Repay Store (Zustand)
 * Manages the repay UI flow state for paying back UNIT debt
 */

import { create } from 'zustand';
import { logger } from '../utils/logger';
import {
  computeHealthFactor,
  computeLiquidationPrice,
  getHealthStatus,
  type HealthStatus,
} from '../utils/vaultUtils';

export type RepayStep =
  | 'input' // Step 1: Enter UNIT repay amount
  | 'confirm' // Step 2: Review and confirm
  | 'processing' // Step 3: Transaction in progress
  | 'success'; // Step 4: Transaction complete

export type RepayProcessingStep = 1 | 2 | 3 | 4;
// 1: Awaiting user signatures
// 2: Request received by node
// 3: Validation in progress
// 4: Network approvals

interface RepayState {
  // Form data
  repayAmountUnit: number; // UNIT to repay (in UNIT, not cents)
  selectedFeeRate: number;

  // Current vault data
  currentUnitBorrowed: number; // Current UNIT debt in vault
  currentBtcLocked: number; // Current BTC locked in vault (in BTC, not sats)
  bitcoinPrice: number | null;
  availableUnitBalance: number; // Available UNIT balance for repay

  // Process state
  currentStep: RepayStep;
  processingStep: RepayProcessingStep;
  loading: boolean;
  error: string | null;
  issueTxid: string | null;
  vaultTxid: string | null;
}

interface RepayActions {
  // Form actions
  setRepayAmountUnit: (amount: number) => void;
  setSelectedFeeRate: (rate: number) => void;

  // Vault data actions
  setCurrentVaultData: (unitBorrowed: number, btcLocked: number) => void;
  setBitcoinPrice: (price: number | null) => void;
  setAvailableUnitBalance: (balance: number) => void;

  // Navigation
  setCurrentStep: (step: RepayStep) => void;
  setProcessingStep: (step: RepayProcessingStep) => void;

  // Process actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setIssueTxid: (txid: string | null) => void;
  setVaultTxid: (vaultTxid: string | null) => void;

  // Computed getters
  getNewDebt: () => number;
  getHealthFactor: () => number;
  getNewHealthFactor: () => number;
  getLiquidationPrice: () => number;
  getNewLiquidationPrice: () => number;
  getHealthStatus: () => HealthStatus;
  getNewHealthStatus: () => HealthStatus;
  getMaxRepayable: () => number;

  // Reset
  reset: () => void;
}

type RepayStore = RepayState & RepayActions;

const initialState: RepayState = {
  repayAmountUnit: 0,
  selectedFeeRate: 1,
  currentUnitBorrowed: 0,
  currentBtcLocked: 0,
  bitcoinPrice: null,
  availableUnitBalance: 0,
  currentStep: 'input',
  processingStep: 1,
  loading: false,
  error: null,
  issueTxid: null,
  vaultTxid: null,
};

export const useRepayStore = create<RepayStore>((set, get) => ({
  // Initial state
  ...initialState,

  // Form actions
  setRepayAmountUnit: (repayAmountUnit) => {
    logger.debug('[RepayStore] setRepayAmountUnit:', repayAmountUnit);
    set({ repayAmountUnit, error: null });
  },

  setSelectedFeeRate: (selectedFeeRate) => {
    logger.debug('[RepayStore] setSelectedFeeRate:', selectedFeeRate);
    set({ selectedFeeRate });
  },

  // Vault data actions
  setCurrentVaultData: (unitBorrowed, btcLocked) => {
    logger.debug('[RepayStore] setCurrentVaultData:', { unitBorrowed, btcLocked });
    set({
      currentUnitBorrowed: unitBorrowed,
      currentBtcLocked: btcLocked,
    });
  },

  setBitcoinPrice: (bitcoinPrice) => {
    set({ bitcoinPrice });
  },

  setAvailableUnitBalance: (availableUnitBalance) => {
    logger.debug('[RepayStore] setAvailableUnitBalance:', availableUnitBalance);
    set({ availableUnitBalance });
  },

  // Navigation
  setCurrentStep: (currentStep) => {
    logger.debug('[RepayStore] setCurrentStep:', currentStep);
    set({ currentStep, error: null });
  },

  setProcessingStep: (processingStep) => {
    logger.debug('[RepayStore] setProcessingStep:', processingStep);
    set({ processingStep });
  },

  // Process actions
  setLoading: (loading) => set({ loading }),

  setError: (error) => {
    logger.debug('[RepayStore] setError:', error);
    set({ error, loading: false });
  },

  setIssueTxid: (issueTxid) => {
    logger.debug('[RepayStore] setIssueTxid:', issueTxid);
    set({ issueTxid });
  },

  setVaultTxid: (vaultTxid) => {
    logger.debug('[RepayStore] setVaultTxid:', vaultTxid);
    set({ vaultTxid });
  },

  // Computed getters
  getNewDebt: () => {
    const { currentUnitBorrowed, repayAmountUnit } = get();
    return Math.max(0, currentUnitBorrowed - repayAmountUnit);
  },

  getHealthFactor: () => {
    const { currentBtcLocked, currentUnitBorrowed, bitcoinPrice } = get();
    if (!bitcoinPrice || currentBtcLocked <= 0 || currentUnitBorrowed <= 0) return 0;
    return computeHealthFactor(currentBtcLocked, bitcoinPrice, currentUnitBorrowed);
  },

  getNewHealthFactor: () => {
    const { repayAmountUnit, currentBtcLocked, currentUnitBorrowed, bitcoinPrice } = get();
    const newDebt = Math.max(0, currentUnitBorrowed - repayAmountUnit);
    if (!bitcoinPrice || currentBtcLocked <= 0 || newDebt <= 0) return 999; // Max health when fully repaid
    return computeHealthFactor(currentBtcLocked, bitcoinPrice, newDebt);
  },

  getLiquidationPrice: () => {
    const { currentBtcLocked, currentUnitBorrowed } = get();
    if (currentBtcLocked <= 0 || currentUnitBorrowed <= 0) return 0;
    return computeLiquidationPrice(currentUnitBorrowed, currentBtcLocked);
  },

  getNewLiquidationPrice: () => {
    const { repayAmountUnit, currentBtcLocked, currentUnitBorrowed } = get();
    const newDebt = Math.max(0, currentUnitBorrowed - repayAmountUnit);
    if (currentBtcLocked <= 0) return 0;
    return computeLiquidationPrice(newDebt, currentBtcLocked);
  },

  getHealthStatus: () => {
    const healthFactor = get().getHealthFactor();
    return getHealthStatus(healthFactor);
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

  // Reset
  reset: () => {
    logger.debug('[RepayStore] reset');
    set(initialState);
  },
}));

/**
 * Selector hooks for granular subscriptions
 */
export const useRepayAmountUnit = () => useRepayStore((state) => state.repayAmountUnit);
export const useRepayCurrentStep = () => useRepayStore((state) => state.currentStep);
export const useRepayProcessingStep = () => useRepayStore((state) => state.processingStep);
export const useRepayLoading = () => useRepayStore((state) => state.loading);
export const useRepayError = () => useRepayStore((state) => state.error);
export const useRepayIssueTxid = () => useRepayStore((state) => state.issueTxid);
export const useRepayVaultTxid = () => useRepayStore((state) => state.vaultTxid);

/**
 * Reset store to initial state (useful for testing)
 */
export const resetRepayStore = () => {
  useRepayStore.setState(initialState);
};

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

  const healthFactor = (!bitcoinPrice || currentBtcLocked <= 0 || currentUnitBorrowed <= 0)
    ? 0
    : computeHealthFactor(currentBtcLocked, bitcoinPrice, currentUnitBorrowed);

  const newHealthFactor = (!bitcoinPrice || currentBtcLocked <= 0 || newDebt <= 0)
    ? 999 // Max health when fully repaid
    : computeHealthFactor(currentBtcLocked, bitcoinPrice, newDebt);

  const liquidationPrice = (currentBtcLocked <= 0 || currentUnitBorrowed <= 0)
    ? 0
    : computeLiquidationPrice(currentUnitBorrowed, currentBtcLocked);

  const newLiquidationPrice = (currentBtcLocked <= 0)
    ? 0
    : computeLiquidationPrice(newDebt, currentBtcLocked);

  const healthStatus = getHealthStatus(healthFactor);
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
