/**
 * Vault Store Types
 * Shared type definitions for all vault operation stores
 */

import type { HealthStatus } from '../../utils/vaultUtils';

/**
 * Common step type for all vault operations
 */
export type VaultOperationStep =
  | 'input'      // Step 1: Enter amount
  | 'payout'     // Step 2: Choose payout asset
  | 'confirm'    // Step 3: Review and confirm
  | 'processing' // Step 4: Transaction in progress
  | 'success';   // Step 5: Transaction complete

/**
 * Processing substeps (1-4)
 */
export type ProcessingStep = 1 | 2 | 3 | 4;
// 1: Awaiting user signatures
// 2: Request received by node
// 3: Validation in progress
// 4: Network approvals

/**
 * Common state shared by all vault operation stores
 */
export interface CommonVaultState {
  // Fee selection
  selectedFeeRate: number;

  // Current vault data
  currentUnitBorrowed: number;
  currentBtcLocked: number;
  bitcoinPrice: number | null;

  // Process state
  currentStep: VaultOperationStep;
  processingStep: ProcessingStep;
  loading: boolean;
  error: string | null;
  vaultTxid: string | null;
}

/**
 * Common actions shared by all vault operation stores
 */
export interface CommonVaultActions {
  // Fee actions
  setSelectedFeeRate: (rate: number) => void;

  // Vault data actions
  setCurrentVaultData: (unitBorrowed: number, btcLocked: number) => void;
  setBitcoinPrice: (price: number | null) => void;

  // Navigation
  setCurrentStep: (step: VaultOperationStep) => void;
  setProcessingStep: (step: ProcessingStep) => void;

  // Process actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setVaultTxid: (vaultTxid: string | null) => void;

  // Common computed getters
  getHealthFactor: () => number;
  getLiquidationPrice: () => number;
  getHealthStatus: () => HealthStatus;

  // Reset
  reset: () => void;
}

/**
 * Initial state for common fields
 */
export const commonInitialState: CommonVaultState = {
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
