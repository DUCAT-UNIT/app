/**
 * Deposit Store (Zustand)
 * Manages the deposit UI flow state for adding more BTC collateral to an existing vault
 */

import { create } from 'zustand';
import { logger } from '../utils/logger';
import {
  computeHealthFactor,
  computeLiquidationPrice,
  getHealthStatus,
  type HealthStatus,
} from '../utils/vaultUtils';

export type DepositStep =
  | 'input' // Step 1: Enter BTC deposit amount
  | 'confirm' // Step 2: Review and confirm
  | 'processing' // Step 3: Transaction in progress
  | 'success'; // Step 4: Transaction complete

export type DepositProcessingStep = 1 | 2 | 3 | 4;
// 1: Awaiting user signatures
// 2: Request received by node
// 3: Validation in progress
// 4: Network approvals

interface DepositState {
  // Form data
  depositAmountSats: number; // BTC to deposit in satoshis
  selectedFeeRate: number;

  // Current vault data
  currentUnitBorrowed: number; // Current UNIT debt in vault
  currentBtcLocked: number; // Current BTC locked in vault (in BTC, not sats)
  bitcoinPrice: number | null;
  availableBalance: number; // Available BTC balance for deposit (in sats)

  // Process state
  currentStep: DepositStep;
  processingStep: DepositProcessingStep;
  loading: boolean;
  error: string | null;
  vaultTxid: string | null;
}

interface DepositActions {
  // Form actions
  setDepositAmountSats: (amount: number) => void;
  setDepositAmountBtc: (amount: number) => void;
  setSelectedFeeRate: (rate: number) => void;

  // Vault data actions
  setCurrentVaultData: (unitBorrowed: number, btcLocked: number) => void;
  setBitcoinPrice: (price: number | null) => void;
  setAvailableBalance: (balance: number) => void;

  // Navigation
  setCurrentStep: (step: DepositStep) => void;
  setProcessingStep: (step: DepositProcessingStep) => void;

  // Process actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setVaultTxid: (vaultTxid: string | null) => void;

  // Computed getters
  getDepositAmountBtc: () => number;
  getTotalCollateral: () => number;
  getHealthFactor: () => number;
  getNewHealthFactor: () => number;
  getLiquidationPrice: () => number;
  getNewLiquidationPrice: () => number;
  getHealthStatus: () => HealthStatus;
  getNewHealthStatus: () => HealthStatus;

  // Reset
  reset: () => void;
}

type DepositStore = DepositState & DepositActions;

const initialState: DepositState = {
  depositAmountSats: 0,
  selectedFeeRate: 1,
  currentUnitBorrowed: 0,
  currentBtcLocked: 0,
  bitcoinPrice: null,
  availableBalance: 0,
  currentStep: 'input',
  processingStep: 1,
  loading: false,
  error: null,
  vaultTxid: null,
};

export const useDepositStore = create<DepositStore>((set, get) => ({
  // Initial state
  ...initialState,

  // Form actions
  setDepositAmountSats: (depositAmountSats) => {
    logger.debug('[DepositStore] setDepositAmountSats:', depositAmountSats);
    set({ depositAmountSats, error: null });
  },

  setDepositAmountBtc: (btcAmount) => {
    const sats = Math.round(btcAmount * 100_000_000);
    logger.debug('[DepositStore] setDepositAmountBtc:', { btcAmount, sats });
    set({ depositAmountSats: sats, error: null });
  },

  setSelectedFeeRate: (selectedFeeRate) => {
    logger.debug('[DepositStore] setSelectedFeeRate:', selectedFeeRate);
    set({ selectedFeeRate });
  },

  // Vault data actions
  setCurrentVaultData: (unitBorrowed, btcLocked) => {
    logger.debug('[DepositStore] setCurrentVaultData:', { unitBorrowed, btcLocked });
    set({
      currentUnitBorrowed: unitBorrowed,
      currentBtcLocked: btcLocked,
    });
  },

  setBitcoinPrice: (bitcoinPrice) => {
    set({ bitcoinPrice });
  },

  setAvailableBalance: (availableBalance) => {
    logger.debug('[DepositStore] setAvailableBalance:', availableBalance);
    set({ availableBalance });
  },

  // Navigation
  setCurrentStep: (currentStep) => {
    logger.debug('[DepositStore] setCurrentStep:', currentStep);
    set({ currentStep, error: null });
  },

  setProcessingStep: (processingStep) => {
    logger.debug('[DepositStore] setProcessingStep:', processingStep);
    set({ processingStep });
  },

  // Process actions
  setLoading: (loading) => set({ loading }),

  setError: (error) => {
    logger.debug('[DepositStore] setError:', error);
    set({ error, loading: false });
  },

  setVaultTxid: (vaultTxid) => {
    logger.debug('[DepositStore] setVaultTxid:', vaultTxid);
    set({ vaultTxid });
  },

  // Computed getters
  getDepositAmountBtc: () => {
    const { depositAmountSats } = get();
    return depositAmountSats / 100_000_000;
  },

  getTotalCollateral: () => {
    const { currentBtcLocked, depositAmountSats } = get();
    return currentBtcLocked + depositAmountSats / 100_000_000;
  },

  getHealthFactor: () => {
    const { currentBtcLocked, currentUnitBorrowed, bitcoinPrice } = get();
    if (!bitcoinPrice || currentBtcLocked <= 0 || currentUnitBorrowed <= 0) return 0;
    return computeHealthFactor(currentBtcLocked, bitcoinPrice, currentUnitBorrowed);
  },

  getNewHealthFactor: () => {
    const { depositAmountSats, currentBtcLocked, currentUnitBorrowed, bitcoinPrice } = get();
    const totalCollateral = currentBtcLocked + depositAmountSats / 100_000_000;
    if (!bitcoinPrice || totalCollateral <= 0 || currentUnitBorrowed <= 0) return 0;
    return computeHealthFactor(totalCollateral, bitcoinPrice, currentUnitBorrowed);
  },

  getLiquidationPrice: () => {
    const { currentBtcLocked, currentUnitBorrowed } = get();
    if (currentBtcLocked <= 0 || currentUnitBorrowed <= 0) return 0;
    return computeLiquidationPrice(currentUnitBorrowed, currentBtcLocked);
  },

  getNewLiquidationPrice: () => {
    const { depositAmountSats, currentBtcLocked, currentUnitBorrowed } = get();
    const totalCollateral = currentBtcLocked + depositAmountSats / 100_000_000;
    if (totalCollateral <= 0 || currentUnitBorrowed <= 0) return 0;
    return computeLiquidationPrice(currentUnitBorrowed, totalCollateral);
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
    logger.debug('[DepositStore] reset');
    set(initialState);
  },
}));

/**
 * Selector hooks for granular subscriptions
 */
export const useDepositAmountSats = () => useDepositStore((state) => state.depositAmountSats);
export const useDepositCurrentStep = () => useDepositStore((state) => state.currentStep);
export const useDepositProcessingStep = () => useDepositStore((state) => state.processingStep);
export const useDepositLoading = () => useDepositStore((state) => state.loading);
export const useDepositError = () => useDepositStore((state) => state.error);
export const useDepositVaultTxid = () => useDepositStore((state) => state.vaultTxid);

/**
 * Reset store to initial state (useful for testing)
 */
export const resetDepositStore = () => {
  useDepositStore.setState(initialState);
};

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
  const totalCollateral = currentBtcLocked + depositAmountSats / 100_000_000;

  const healthFactor = (!bitcoinPrice || currentBtcLocked <= 0 || currentUnitBorrowed <= 0)
    ? 0
    : computeHealthFactor(currentBtcLocked, bitcoinPrice, currentUnitBorrowed);

  const newHealthFactor = (!bitcoinPrice || totalCollateral <= 0 || currentUnitBorrowed <= 0)
    ? 0
    : computeHealthFactor(totalCollateral, bitcoinPrice, currentUnitBorrowed);

  const liquidationPrice = (currentBtcLocked <= 0 || currentUnitBorrowed <= 0)
    ? 0
    : computeLiquidationPrice(currentUnitBorrowed, currentBtcLocked);

  const newLiquidationPrice = (totalCollateral <= 0 || currentUnitBorrowed <= 0)
    ? 0
    : computeLiquidationPrice(currentUnitBorrowed, totalCollateral);

  const healthStatus = getHealthStatus(healthFactor);
  const newHealthStatus = getHealthStatus(newHealthFactor);

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
