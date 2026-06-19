/**
 * Vault Creation Store (Zustand)
 * Manages the vault creation UI flow state
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import { VAULT_CONFIG } from '../utils/constants';
import {
  computeHealthFactor,
  computeLiquidationPrice,
  getMaxUnit,
  getHealthStatus,
  type HealthStatus,
} from '../utils/vaultUtils';
import { protocolUnitToUsd, usdToProtocolUnitAmount } from '../utils/vaultFaceValue';
import type { VaultSettlementRequestedAsset } from './vaultSettlementStore';

export type VaultCreationStep =
  | 'amounts' // Step 1: Enter BTC deposit and UNIT borrow amounts
  | 'payout' // Step 2: Choose payout asset
  | 'confirm' // Step 3: Review and confirm
  | 'processing' // Step 4: Transaction in progress
  | 'success'; // Step 5: Transaction complete

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
  receiveAsset: VaultSettlementRequestedAsset;
  selectedFeeRate: number;

  // Calculated values (derived from form data and price)
  bitcoinPrice: number | null;

  // Process state
  currentStep: VaultCreationStep;
  processingStep: ProcessingStep;
  loading: boolean;
  error: string | null;
  txid: string | null;
  vaultTxid: string | null;

  // Hydration tracking
  _hasHydrated: boolean;
}

interface VaultCreationActions {
  // Form actions
  setBtcAmount: (amount: number) => void;
  setUnitAmount: (amount: number) => void;
  setReceiveAsset: (asset: VaultSettlementRequestedAsset) => void;
  setSelectedFeeRate: (rate: number) => void;
  setBitcoinPrice: (price: number | null) => void;

  // Navigation
  setCurrentStep: (step: VaultCreationStep) => void;
  setProcessingStep: (step: ProcessingStep) => void;

  // Process actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTxid: (txid: string | null) => void;
  setVaultTxid: (txid: string | null) => void;

  // Computed getters
  getHealthFactor: () => number;
  getLiquidationPrice: () => number;
  getMaxBorrowable: () => number | null;
  getHealthStatus: () => HealthStatus;

  // Reset
  reset: () => void;

  // Persistence
  clearPersistedState: () => Promise<void>;
}

type VaultCreationStore = VaultCreationState & VaultCreationActions;

const initialState: VaultCreationState = {
  btcAmount: 0,
  unitAmount: 0,
  receiveAsset: 'UNIT',
  selectedFeeRate: VAULT_CONFIG.DEFAULT_FEE_RATE,
  bitcoinPrice: null,
  currentStep: 'amounts',
  processingStep: 1,
  loading: false,
  error: null,
  txid: null,
  vaultTxid: null,
  _hasHydrated: false,
};

function normalizePersistedVaultCreationStep(currentStep: VaultCreationStep): VaultCreationStep {
  return currentStep === 'processing' || currentStep === 'success' ? 'confirm' : currentStep;
}

export function getPersistedVaultCreationState(
  state: VaultCreationStore
): Pick<
  VaultCreationState,
  'btcAmount' | 'unitAmount' | 'receiveAsset' | 'selectedFeeRate' | 'currentStep'
> {
  const currentStep = normalizePersistedVaultCreationStep(state.currentStep);

  return {
    btcAmount: state.btcAmount,
    unitAmount: state.unitAmount,
    receiveAsset: state.receiveAsset,
    selectedFeeRate: state.selectedFeeRate,
    currentStep,
  };
}

export const useVaultCreationStore = create<VaultCreationStore>()(
  persist(
    (set, get) => ({
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

      setReceiveAsset: (receiveAsset) => {
        logger.debug('[VaultCreationStore] setReceiveAsset:', receiveAsset);
        set({ receiveAsset });
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

      setVaultTxid: (vaultTxid) => {
        logger.debug('[VaultCreationStore] setVaultTxid:', vaultTxid);
        set({ vaultTxid });
      },

      // Computed getters
      getHealthFactor: () => {
        const { btcAmount, unitAmount, bitcoinPrice } = get();
        const protocolUnitAmount = usdToProtocolUnitAmount(unitAmount);
        if (!bitcoinPrice || btcAmount <= 0 || protocolUnitAmount <= 0) return 0;
        return computeHealthFactor(btcAmount, bitcoinPrice, protocolUnitAmount);
      },

      getLiquidationPrice: () => {
        const { btcAmount, unitAmount } = get();
        if (btcAmount <= 0) return 0;
        return computeLiquidationPrice(usdToProtocolUnitAmount(unitAmount), btcAmount);
      },

      getMaxBorrowable: () => {
        const { btcAmount, bitcoinPrice } = get();
        const maxUnit = getMaxUnit(btcAmount, bitcoinPrice ?? undefined);
        return maxUnit === null ? null : protocolUnitToUsd(maxUnit);
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

      // Persistence
      clearPersistedState: async () => {
        logger.debug('[VaultCreationStore] clearPersistedState');
        try {
          await AsyncStorage.removeItem('vault-creation');
        } catch (error) {
          logger.error('[VaultCreationStore] Failed to clear persisted state:', { error });
        }
        set(initialState);
      },
    }),
    {
      name: 'vault-creation',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist user-progress fields, NOT transient state (loading, error, txid, processingStep)
      partialize: getPersistedVaultCreationState,
      onRehydrateStorage: () => {
        logger.debug('[VaultCreationStore] Hydration started');
        return (state, error) => {
          if (error) {
            logger.error('[VaultCreationStore] Hydration failed:', { error });
          } else {
            const currentStep = normalizePersistedVaultCreationStep(
              state?.currentStep ?? initialState.currentStep
            );
            logger.debug('[VaultCreationStore] Hydration complete:', {
              btcAmount: state?.btcAmount,
              unitAmount: state?.unitAmount,
              currentStep,
            });
            if (state && state.currentStep !== currentStep) {
              useVaultCreationStore.setState({ currentStep });
            }
          }
          useVaultCreationStore.setState({ _hasHydrated: true });
        };
      },
    }
  )
);

/**
 * Reset store to initial state (useful for testing)
 */
export const resetVaultCreationStore = () => {
  useVaultCreationStore.setState({ ...initialState, _hasHydrated: true });
};

/**
 * useVaultCreation - Hook that returns commonly used state and actions
 */
export const useVaultCreation = () => {
  const store = useVaultCreationStore();
  const protocolUnitAmount = usdToProtocolUnitAmount(store.unitAmount);
  const maxBorrowableUsd = store.getMaxBorrowable();

  return {
    // State
    btcAmount: store.btcAmount,
    borrowAmountUsd: store.unitAmount,
    unitAmount: store.unitAmount,
    receiveAsset: store.receiveAsset,
    selectedFeeRate: store.selectedFeeRate,
    bitcoinPrice: store.bitcoinPrice,
    currentStep: store.currentStep,
    processingStep: store.processingStep,
    loading: store.loading,
    error: store.error,
    txid: store.txid,
    vaultTxid: store.vaultTxid,

    // Computed
    protocolUnitAmount,
    healthFactor: store.getHealthFactor(),
    liquidationPrice: store.getLiquidationPrice(),
    maxBorrowableUsd,
    maxBorrowable: store.getMaxBorrowable(),
    healthStatus: store.getHealthStatus(),

    // Actions
    setBtcAmount: store.setBtcAmount,
    setBorrowAmountUsd: store.setUnitAmount,
    setUnitAmount: store.setUnitAmount,
    setReceiveAsset: store.setReceiveAsset,
    setSelectedFeeRate: store.setSelectedFeeRate,
    setBitcoinPrice: store.setBitcoinPrice,
    setCurrentStep: store.setCurrentStep,
    setProcessingStep: store.setProcessingStep,
    setLoading: store.setLoading,
    setError: store.setError,
    setTxid: store.setTxid,
    setVaultTxid: store.setVaultTxid,
    reset: store.reset,
  };
};
