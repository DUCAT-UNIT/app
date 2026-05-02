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
import { protocolUnitToUsd, usdToProtocolUnitAmount } from '../utils/vaultFaceValue';
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
  repayAmountUnit: number; // Face-value USD shown to the user, settles as protocol UNIT 1:1
  availableUsdcBalance: number; // Available Sepolia USDC that can be swapped back into UNIT for repay
  availableTurboUnitBalance: number; // Available TurboUNIT that can be melted back into UNIT for repay
  availableDirectUnitBalance: number; // Spendable Mutinynet UNIT already in-wallet for direct repay resume
  estimatedUsdcIn: string | null;
  estimatedSepoliaFeeEth: string | null;
  estimatedTurboUnitIn: string | null;
  estimatedTurboUnitFee: string | null;
  issueTxid: string | null;
}

/**
 * Repay-specific actions (extends common actions)
 */
interface RepaySpecificActions {
  // Form actions
  setRepayAmountUnit: (amount: number) => void;
  setAvailableUsdcBalance: (balance: number) => void;
  setAvailableTurboUnitBalance: (balance: number) => void;
  setAvailableDirectUnitBalance: (balance: number) => void;
  setRepayQuote: (estimatedUsdcIn: string | null, estimatedSepoliaFeeEth: string | null) => void;
  setTurboRepayQuote: (estimatedTurboUnitIn: string | null, estimatedTurboUnitFee: string | null) => void;
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
  availableUsdcBalance: 0,
  availableTurboUnitBalance: 0,
  availableDirectUnitBalance: 0,
  estimatedUsdcIn: null,
  estimatedSepoliaFeeEth: null,
  estimatedTurboUnitIn: null,
  estimatedTurboUnitFee: null,
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

    setAvailableUsdcBalance: (availableUsdcBalance: number) => {
      logger.debug('[RepayStore] setAvailableUsdcBalance:', availableUsdcBalance);
      set({ availableUsdcBalance } as Partial<CommonVaultState & CommonVaultActions & RepayExtension>);
    },

    setAvailableTurboUnitBalance: (availableTurboUnitBalance: number) => {
      logger.debug('[RepayStore] setAvailableTurboUnitBalance:', availableTurboUnitBalance);
      set({ availableTurboUnitBalance } as Partial<CommonVaultState & CommonVaultActions & RepayExtension>);
    },

    setAvailableDirectUnitBalance: (availableDirectUnitBalance: number) => {
      logger.debug('[RepayStore] setAvailableDirectUnitBalance:', availableDirectUnitBalance);
      set({ availableDirectUnitBalance } as Partial<CommonVaultState & CommonVaultActions & RepayExtension>);
    },

    setRepayQuote: (estimatedUsdcIn: string | null, estimatedSepoliaFeeEth: string | null) => {
      logger.debug('[RepayStore] setRepayQuote:', { estimatedUsdcIn, estimatedSepoliaFeeEth });
      set({
        estimatedUsdcIn,
        estimatedSepoliaFeeEth,
      } as Partial<CommonVaultState & CommonVaultActions & RepayExtension>);
    },

    setTurboRepayQuote: (estimatedTurboUnitIn: string | null, estimatedTurboUnitFee: string | null) => {
      logger.debug('[RepayStore] setTurboRepayQuote:', { estimatedTurboUnitIn, estimatedTurboUnitFee });
      set({
        estimatedTurboUnitIn,
        estimatedTurboUnitFee,
      } as Partial<CommonVaultState & CommonVaultActions & RepayExtension>);
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
      const {
        currentUnitBorrowed,
        availableUsdcBalance,
        availableTurboUnitBalance,
        availableDirectUnitBalance,
      } = get();
      // The repay can be funded by either direct released UNIT already in-wallet
      // or by TurboUNIT/Sepolia USDC that will be converted back into UNIT.
      const availableRepayFunding = Math.max(
        availableUsdcBalance,
        availableTurboUnitBalance,
        availableDirectUnitBalance,
      );
      return Math.min(currentUnitBorrowed, availableRepayFunding);
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
  const availableUsdcBalance = useRepayStore((state) => state.availableUsdcBalance);
  const availableTurboUnitBalance = useRepayStore((state) => state.availableTurboUnitBalance);
  const availableDirectUnitBalance = useRepayStore((state) => state.availableDirectUnitBalance);
  const estimatedUsdcIn = useRepayStore((state) => state.estimatedUsdcIn);
  const estimatedSepoliaFeeEth = useRepayStore((state) => state.estimatedSepoliaFeeEth);
  const estimatedTurboUnitIn = useRepayStore((state) => state.estimatedTurboUnitIn);
  const estimatedTurboUnitFee = useRepayStore((state) => state.estimatedTurboUnitFee);
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
  const setAvailableUsdcBalance = useRepayStore((state) => state.setAvailableUsdcBalance);
  const setAvailableTurboUnitBalance = useRepayStore((state) => state.setAvailableTurboUnitBalance);
  const setAvailableDirectUnitBalance = useRepayStore((state) => state.setAvailableDirectUnitBalance);
  const setRepayQuote = useRepayStore((state) => state.setRepayQuote);
  const setTurboRepayQuote = useRepayStore((state) => state.setTurboRepayQuote);
  const setCurrentStep = useRepayStore((state) => state.setCurrentStep);
  const setProcessingStep = useRepayStore((state) => state.setProcessingStep);
  const setLoading = useRepayStore((state) => state.setLoading);
  const setError = useRepayStore((state) => state.setError);
  const setIssueTxid = useRepayStore((state) => state.setIssueTxid);
  const setVaultTxid = useRepayStore((state) => state.setVaultTxid);
  const reset = useRepayStore((state) => state.reset);

  // Compute derived values from reactive state
  const newDebt = Math.max(0, currentUnitBorrowed - repayAmountUnit);
  const repayAmountUsd = protocolUnitToUsd(repayAmountUnit);

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
  const maxRepayable = Math.min(
    currentUnitBorrowed,
    Math.max(availableUsdcBalance, availableTurboUnitBalance, availableDirectUnitBalance),
  );
  const maxRepayableUsd = protocolUnitToUsd(maxRepayable);
  const availableRepayBalanceUsd = protocolUnitToUsd(availableUsdcBalance);
  const availableTurboUnitBalanceUsd = protocolUnitToUsd(availableTurboUnitBalance);
  const availableDirectUnitBalanceUsd = protocolUnitToUsd(availableDirectUnitBalance);

  return {
    // State
    repayAmountUsd,
    repayAmountUnit,
    selectedFeeRate,
    currentUnitBorrowed,
    currentBtcLocked,
    bitcoinPrice,
    availableRepayBalanceUsd,
    availableUsdcBalance,
    availableTurboUnitBalance,
    availableTurboUnitBalanceUsd,
    availableDirectUnitBalance,
    availableDirectUnitBalanceUsd,
    estimatedUsdcIn,
    estimatedSepoliaFeeEth,
    estimatedTurboUnitIn,
    estimatedTurboUnitFee,
    currentStep,
    processingStep,
    loading,
    error,
    issueTxid,
    vaultTxid,

    // Computed
    protocolRepayAmount: usdToProtocolUnitAmount(repayAmountUsd),
    newDebt,
    healthFactor,
    newHealthFactor,
    liquidationPrice,
    newLiquidationPrice,
    healthStatus,
    newHealthStatus,
    maxRepayableUsd,
    maxRepayable,

    // Actions
    setRepayAmountUsd: setRepayAmountUnit,
    setRepayAmountUnit,
    setAvailableRepayBalanceUsd: setAvailableUsdcBalance,
    setRepayQuote,
    setSelectedFeeRate,
    setCurrentVaultData,
    setBitcoinPrice,
    setAvailableUsdcBalance,
    setAvailableTurboUnitBalance,
    setAvailableDirectUnitBalance,
    setTurboRepayQuote,
    setCurrentStep,
    setProcessingStep,
    setLoading,
    setError,
    setIssueTxid,
    setVaultTxid,
    reset,
  };
};
