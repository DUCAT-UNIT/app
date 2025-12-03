/**
 * Withdraw Store (Zustand)
 * Manages the withdraw UI flow state for withdrawing BTC collateral from an existing vault
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

export type WithdrawStep =
  | 'input' // Step 1: Enter BTC withdraw amount
  | 'confirm' // Step 2: Review and confirm
  | 'processing' // Step 3: Transaction in progress
  | 'success'; // Step 4: Transaction complete

export type WithdrawProcessingStep = 1 | 2 | 3 | 4;
// 1: Awaiting user signatures
// 2: Request received by node
// 3: Validation in progress
// 4: Network approvals

interface WithdrawState {
  // Form data
  withdrawAmountSats: number; // BTC to withdraw in satoshis
  selectedFeeRate: number;

  // Current vault data
  currentUnitBorrowed: number; // Current UNIT debt in vault
  currentBtcLocked: number; // Current BTC locked in vault (in BTC, not sats)
  bitcoinPrice: number | null;

  // Process state
  currentStep: WithdrawStep;
  processingStep: WithdrawProcessingStep;
  loading: boolean;
  error: string | null;
  vaultTxid: string | null;
}

interface WithdrawActions {
  // Form actions
  setWithdrawAmountSats: (amount: number) => void;
  setWithdrawAmountBtc: (amount: number) => void;
  setSelectedFeeRate: (rate: number) => void;

  // Vault data actions
  setCurrentVaultData: (unitBorrowed: number, btcLocked: number) => void;
  setBitcoinPrice: (price: number | null) => void;

  // Navigation
  setCurrentStep: (step: WithdrawStep) => void;
  setProcessingStep: (step: WithdrawProcessingStep) => void;

  // Process actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setVaultTxid: (vaultTxid: string | null) => void;

  // Computed getters
  getWithdrawAmountBtc: () => number;
  getNewCollateral: () => number;
  getHealthFactor: () => number;
  getNewHealthFactor: () => number;
  getLiquidationPrice: () => number;
  getNewLiquidationPrice: () => number;
  getHealthStatus: () => HealthStatus;
  getNewHealthStatus: () => HealthStatus;
  getMaxWithdrawable: () => number; // Max BTC that can be withdrawn while maintaining min health

  // Reset
  reset: () => void;
}

type WithdrawStore = WithdrawState & WithdrawActions;

const initialState: WithdrawState = {
  withdrawAmountSats: 0,
  selectedFeeRate: 1,
  currentUnitBorrowed: 0,
  currentBtcLocked: 0,
  bitcoinPrice: null,
  currentStep: 'input',
  processingStep: 1,
  loading: false,
  error: null,
  vaultTxid: null,
};

export const useWithdrawStore = create<WithdrawStore>((set, get) => ({
  // Initial state
  ...initialState,

  // Form actions
  setWithdrawAmountSats: (withdrawAmountSats) => {
    logger.debug('[WithdrawStore] setWithdrawAmountSats:', withdrawAmountSats);
    set({ withdrawAmountSats, error: null });
  },

  setWithdrawAmountBtc: (btcAmount) => {
    const sats = Math.round(btcAmount * 100_000_000);
    logger.debug('[WithdrawStore] setWithdrawAmountBtc:', { btcAmount, sats });
    set({ withdrawAmountSats: sats, error: null });
  },

  setSelectedFeeRate: (selectedFeeRate) => {
    logger.debug('[WithdrawStore] setSelectedFeeRate:', selectedFeeRate);
    set({ selectedFeeRate });
  },

  // Vault data actions
  setCurrentVaultData: (unitBorrowed, btcLocked) => {
    logger.debug('[WithdrawStore] setCurrentVaultData:', { unitBorrowed, btcLocked });
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
    logger.debug('[WithdrawStore] setCurrentStep:', currentStep);
    set({ currentStep, error: null });
  },

  setProcessingStep: (processingStep) => {
    logger.debug('[WithdrawStore] setProcessingStep:', processingStep);
    set({ processingStep });
  },

  // Process actions
  setLoading: (loading) => set({ loading }),

  setError: (error) => {
    logger.debug('[WithdrawStore] setError:', error);
    set({ error, loading: false });
  },

  setVaultTxid: (vaultTxid) => {
    logger.debug('[WithdrawStore] setVaultTxid:', vaultTxid);
    set({ vaultTxid });
  },

  // Computed getters
  getWithdrawAmountBtc: () => {
    const { withdrawAmountSats } = get();
    return withdrawAmountSats / 100_000_000;
  },

  getNewCollateral: () => {
    const { currentBtcLocked, withdrawAmountSats } = get();
    return Math.max(0, currentBtcLocked - withdrawAmountSats / 100_000_000);
  },

  getHealthFactor: () => {
    const { currentBtcLocked, currentUnitBorrowed, bitcoinPrice } = get();
    if (!bitcoinPrice || currentBtcLocked <= 0 || currentUnitBorrowed <= 0) return 0;
    return computeHealthFactor(currentBtcLocked, bitcoinPrice, currentUnitBorrowed);
  },

  getNewHealthFactor: () => {
    const { withdrawAmountSats, currentBtcLocked, currentUnitBorrowed, bitcoinPrice } = get();
    const newCollateral = currentBtcLocked - withdrawAmountSats / 100_000_000;
    if (!bitcoinPrice || newCollateral <= 0 || currentUnitBorrowed <= 0) return 0;
    return computeHealthFactor(newCollateral, bitcoinPrice, currentUnitBorrowed);
  },

  getLiquidationPrice: () => {
    const { currentBtcLocked, currentUnitBorrowed } = get();
    if (currentBtcLocked <= 0 || currentUnitBorrowed <= 0) return 0;
    return computeLiquidationPrice(currentUnitBorrowed, currentBtcLocked);
  },

  getNewLiquidationPrice: () => {
    const { withdrawAmountSats, currentBtcLocked, currentUnitBorrowed } = get();
    const newCollateral = currentBtcLocked - withdrawAmountSats / 100_000_000;
    if (newCollateral <= 0 || currentUnitBorrowed <= 0) return 0;
    return computeLiquidationPrice(currentUnitBorrowed, newCollateral);
  },

  getHealthStatus: () => {
    const healthFactor = get().getHealthFactor();
    return getHealthStatus(healthFactor);
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

  // Reset
  reset: () => {
    logger.debug('[WithdrawStore] reset');
    set(initialState);
  },
}));

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
  useWithdrawStore.setState(initialState);
};

/**
 * useWithdraw - Hook that returns commonly used state and actions
 */
export const useWithdraw = () => {
  const store = useWithdrawStore();
  return {
    // State
    withdrawAmountSats: store.withdrawAmountSats,
    selectedFeeRate: store.selectedFeeRate,
    currentUnitBorrowed: store.currentUnitBorrowed,
    currentBtcLocked: store.currentBtcLocked,
    bitcoinPrice: store.bitcoinPrice,
    currentStep: store.currentStep,
    processingStep: store.processingStep,
    loading: store.loading,
    error: store.error,
    vaultTxid: store.vaultTxid,

    // Computed
    withdrawAmountBtc: store.getWithdrawAmountBtc(),
    newCollateral: store.getNewCollateral(),
    healthFactor: store.getHealthFactor(),
    newHealthFactor: store.getNewHealthFactor(),
    liquidationPrice: store.getLiquidationPrice(),
    newLiquidationPrice: store.getNewLiquidationPrice(),
    healthStatus: store.getHealthStatus(),
    newHealthStatus: store.getNewHealthStatus(),
    maxWithdrawable: store.getMaxWithdrawable(),

    // Actions
    setWithdrawAmountSats: store.setWithdrawAmountSats,
    setWithdrawAmountBtc: store.setWithdrawAmountBtc,
    setSelectedFeeRate: store.setSelectedFeeRate,
    setCurrentVaultData: store.setCurrentVaultData,
    setBitcoinPrice: store.setBitcoinPrice,
    setCurrentStep: store.setCurrentStep,
    setProcessingStep: store.setProcessingStep,
    setLoading: store.setLoading,
    setError: store.setError,
    setVaultTxid: store.setVaultTxid,
    reset: store.reset,
  };
};
