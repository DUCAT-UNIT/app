/**
 * createVaultStore Factory
 * Creates common state and actions for vault operation stores
 */

import { StateCreator } from 'zustand';
import { logger } from '../../utils/logger';
import {
  computeHealthFactor,
  computeLiquidationPrice,
  getHealthStatus,
} from '../../utils/vaultUtils';
import {
  type CommonVaultState,
  type CommonVaultActions,
  type VaultOperationStep,
  type ProcessingStep,
  commonInitialState,
} from './vaultStoreTypes';

export interface CreateVaultStoreOptions {
  /** Store name for logging */
  storeName: string;
}

/**
 * Creates common state and actions for a vault operation store
 * Use this with Zustand's slice pattern
 */
export function createCommonVaultSlice<T extends CommonVaultState & CommonVaultActions>(
  options: CreateVaultStoreOptions
): StateCreator<T, [], [], CommonVaultState & CommonVaultActions> {
  const { storeName } = options;

  return (set, get) => ({
    // Initial state
    ...commonInitialState,

    // Fee actions
    setSelectedFeeRate: (selectedFeeRate: number) => {
      logger.debug(`[${storeName}] setSelectedFeeRate:`, selectedFeeRate);
      set({ selectedFeeRate } as Partial<T>);
    },

    // Vault data actions
    setCurrentVaultData: (unitBorrowed: number, btcLocked: number) => {
      logger.debug(`[${storeName}] setCurrentVaultData:`, { unitBorrowed, btcLocked });
      set({
        currentUnitBorrowed: unitBorrowed,
        currentBtcLocked: btcLocked,
      } as Partial<T>);
    },

    setBitcoinPrice: (bitcoinPrice: number | null) => {
      set({ bitcoinPrice } as Partial<T>);
    },

    // Navigation
    setCurrentStep: (currentStep: VaultOperationStep) => {
      logger.debug(`[${storeName}] setCurrentStep:`, currentStep);
      set({ currentStep, error: null } as Partial<T>);
    },

    setProcessingStep: (processingStep: ProcessingStep) => {
      logger.debug(`[${storeName}] setProcessingStep:`, processingStep);
      set({ processingStep } as Partial<T>);
    },

    // Process actions
    setLoading: (loading: boolean) => {
      set({ loading } as Partial<T>);
    },

    setError: (error: string | null) => {
      logger.debug(`[${storeName}] setError:`, error);
      set({ error, loading: false } as Partial<T>);
    },

    setVaultTxid: (vaultTxid: string | null) => {
      logger.debug(`[${storeName}] setVaultTxid:`, vaultTxid);
      set({ vaultTxid } as Partial<T>);
    },

    // Common computed getters
    getHealthFactor: () => {
      const state = get();
      const { currentBtcLocked, currentUnitBorrowed, bitcoinPrice } = state;
      if (!bitcoinPrice || currentBtcLocked <= 0 || currentUnitBorrowed <= 0) return 0;
      return computeHealthFactor(currentBtcLocked, bitcoinPrice, currentUnitBorrowed);
    },

    getLiquidationPrice: () => {
      const state = get();
      const { currentBtcLocked, currentUnitBorrowed } = state;
      if (currentBtcLocked <= 0 || currentUnitBorrowed <= 0) return 0;
      return computeLiquidationPrice(currentUnitBorrowed, currentBtcLocked);
    },

    getHealthStatus: () => {
      const healthFactor = get().getHealthFactor();
      return getHealthStatus(healthFactor);
    },

    // Reset - will be overridden by specific stores to include their initial state
    reset: () => {
      logger.debug(`[${storeName}] reset`);
      set(commonInitialState as Partial<T>);
    },
  });
}

/**
 * Helper to compute derived health values
 * Can be used in specific store hooks
 */
export function computeVaultHealth(
  currentBtcLocked: number,
  currentUnitBorrowed: number,
  bitcoinPrice: number | null
) {
  const healthFactor =
    !bitcoinPrice || currentBtcLocked <= 0 || currentUnitBorrowed <= 0
      ? 0
      : computeHealthFactor(currentBtcLocked, bitcoinPrice, currentUnitBorrowed);

  const liquidationPrice =
    currentBtcLocked <= 0 || currentUnitBorrowed <= 0
      ? 0
      : computeLiquidationPrice(currentUnitBorrowed, currentBtcLocked);

  const healthStatus = getHealthStatus(healthFactor);

  return { healthFactor, liquidationPrice, healthStatus };
}

/**
 * Helper to compute new health values after an operation
 */
export function computeNewVaultHealth(
  newCollateral: number,
  newDebt: number,
  bitcoinPrice: number | null
) {
  const newHealthFactor =
    !bitcoinPrice || newCollateral <= 0 || newDebt <= 0
      ? 0
      : computeHealthFactor(newCollateral, bitcoinPrice, newDebt);

  const newLiquidationPrice =
    newCollateral <= 0 || newDebt <= 0
      ? 0
      : computeLiquidationPrice(newDebt, newCollateral);

  const newHealthStatus = getHealthStatus(newHealthFactor);

  return { newHealthFactor, newLiquidationPrice, newHealthStatus };
}
