/**
 * Vault Creation Store (Zustand)
 * Manages the vault creation UI flow state
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

export type VaultCreationStep =
  | 'amounts' // Step 1: Enter BTC deposit and UNIT borrow amounts
  | 'confirm' // Step 2: Review and confirm
  | 'processing' // Step 3: Transaction in progress
  | 'success'; // Step 4: Transaction complete

// ProcessingStep sourced from canonical vault store types
import type { ProcessingStep } from './vault/vaultStoreTypes';
export type { ProcessingStep } from './vault/vaultStoreTypes';
// 1: Awaiting user signatures
// 2: Request received by node
// 3: Validation in progress
// 4: Network approvals

interface VaultCreationState {
  // Form data
  btcAmount: number;
  unitAmount: number;
  selectedFeeRate: number;

  // Calculated values (derived from form data and price)
  bitcoinPrice: number | null;

  // Process state
  currentStep: VaultCreationStep;
  processingStep: ProcessingStep;
  loading: boolean;
  error: string | null;
  txid: string | null;
}

interface VaultCreationActions {
  // Form actions
  setBtcAmount: (amount: number) => void;
  setUnitAmount: (amount: number) => void;
  setSelectedFeeRate: (rate: number) => void;
  setBitcoinPrice: (price: number | null) => void;

  // Navigation
  setCurrentStep: (step: VaultCreationStep) => void;
  setProcessingStep: (step: ProcessingStep) => void;

  // Process actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTxid: (txid: string | null) => void;

  // Computed getters
  getHealthFactor: () => number;
  getLiquidationPrice: () => number;
  getMaxBorrowable: () => number | null;
  getHealthStatus: () => HealthStatus;

  // Reset
  reset: () => void;
}

type VaultCreationStore = VaultCreationState & VaultCreationActions;

const initialState: VaultCreationState = {
  btcAmount: 0,
  unitAmount: 0,
  selectedFeeRate: 1, // Default 1 sat/vB
  bitcoinPrice: null,
  currentStep: 'amounts',
  processingStep: 1,
  loading: false,
  error: null,
  txid: null,
};

export const useVaultCreationStore = create<VaultCreationStore>((set, get) => ({
  // Initial state
  ...initialState,

  // Form actions
  setBtcAmount: (btcAmount) => {
    logger.debug('[VaultCreationStore] setBtcAmount:', btcAmount);
    set({ btcAmount, error: null });
  },

  setUnitAmount: (unitAmount) => {
    logger.debug('[VaultCreationStore] setUnitAmount:', unitAmount);
    set({ unitAmount, error: null });
  },

  setSelectedFeeRate: (selectedFeeRate) => {
    logger.debug('[VaultCreationStore] setSelectedFeeRate:', selectedFeeRate);
    set({ selectedFeeRate });
  },

  setBitcoinPrice: (bitcoinPrice) => {
    set({ bitcoinPrice });
  },

  // Navigation
  setCurrentStep: (currentStep) => {
    logger.debug('[VaultCreationStore] setCurrentStep:', currentStep);
    set({ currentStep, error: null });
  },

  setProcessingStep: (processingStep) => {
    logger.debug('[VaultCreationStore] setProcessingStep:', processingStep);
    set({ processingStep });
  },

  // Process actions
  setLoading: (loading) => set({ loading }),

  setError: (error) => {
    logger.debug('[VaultCreationStore] setError:', error);
    set({ error, loading: false });
  },

  setTxid: (txid) => {
    logger.debug('[VaultCreationStore] setTxid:', txid);
    set({ txid });
  },

  // Computed getters
  getHealthFactor: () => {
    const { btcAmount, unitAmount, bitcoinPrice } = get();
    if (!bitcoinPrice || btcAmount <= 0 || unitAmount <= 0) return 0;
    return computeHealthFactor(btcAmount, bitcoinPrice, unitAmount);
  },

  getLiquidationPrice: () => {
    const { btcAmount, unitAmount } = get();
    if (btcAmount <= 0) return 0;
    return computeLiquidationPrice(unitAmount, btcAmount);
  },

  getMaxBorrowable: () => {
    const { btcAmount, bitcoinPrice } = get();
    return getMaxUnit(btcAmount, bitcoinPrice ?? undefined);
  },

  getHealthStatus: () => {
    const healthFactor = get().getHealthFactor();
    return getHealthStatus(healthFactor);
  },

  // Reset
  reset: () => {
    logger.debug('[VaultCreationStore] reset');
    set(initialState);
  },
}));

/**
 * Selector hooks for granular subscriptions
 */
export const useBtcAmount = () => useVaultCreationStore((state) => state.btcAmount);
export const useUnitAmount = () => useVaultCreationStore((state) => state.unitAmount);
export const useCurrentStep = () => useVaultCreationStore((state) => state.currentStep);
export const useProcessingStep = () => useVaultCreationStore((state) => state.processingStep);
export const useVaultCreationLoading = () => useVaultCreationStore((state) => state.loading);
export const useVaultCreationError = () => useVaultCreationStore((state) => state.error);
export const useVaultCreationTxid = () => useVaultCreationStore((state) => state.txid);

/**
 * Reset store to initial state (useful for testing)
 */
export const resetVaultCreationStore = () => {
  useVaultCreationStore.setState(initialState);
};

/**
 * useVaultCreation - Hook that returns commonly used state and actions
 */
export const useVaultCreation = () => {
  const store = useVaultCreationStore();
  return {
    // State
    btcAmount: store.btcAmount,
    unitAmount: store.unitAmount,
    selectedFeeRate: store.selectedFeeRate,
    bitcoinPrice: store.bitcoinPrice,
    currentStep: store.currentStep,
    processingStep: store.processingStep,
    loading: store.loading,
    error: store.error,
    txid: store.txid,

    // Computed
    healthFactor: store.getHealthFactor(),
    liquidationPrice: store.getLiquidationPrice(),
    maxBorrowable: store.getMaxBorrowable(),
    healthStatus: store.getHealthStatus(),

    // Actions
    setBtcAmount: store.setBtcAmount,
    setUnitAmount: store.setUnitAmount,
    setSelectedFeeRate: store.setSelectedFeeRate,
    setBitcoinPrice: store.setBitcoinPrice,
    setCurrentStep: store.setCurrentStep,
    setProcessingStep: store.setProcessingStep,
    setLoading: store.setLoading,
    setError: store.setError,
    setTxid: store.setTxid,
    reset: store.reset,
  };
};
