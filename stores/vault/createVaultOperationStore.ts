/**
 * createVaultOperationStore Factory
 *
 * Creates a Zustand store for vault operations (borrow, deposit, repay, withdraw).
 * Each operation gets its own independent store instance with the common vault state shape,
 * optionally extended with operation-specific state and actions.
 *
 * Usage (base store only):
 *   const useMyStore = createVaultOperationStore('borrow');
 *
 * Usage (with extensions):
 *   const useMyStore = createVaultOperationStore('borrow', (set, get, common) => ({
 *     borrowAmount: 0,
 *     setBorrowAmount: (amount) => set({ borrowAmount: amount }),
 *     reset: () => { set({ ...common.initialState, borrowAmount: 0 }); },
 *   }));
 */

import { create } from 'zustand';
import type { StoreApi, UseBoundStore } from 'zustand';
import { logger } from '../../utils/logger';
import {
  computeHealthFactor,
  computeLiquidationPrice,
  getHealthStatus,
} from '../../utils/vaultUtils';
import type {
  CommonVaultState,
  CommonVaultActions,
  VaultOperationStep,
  ProcessingStep,
} from './vaultStoreTypes';
import { commonInitialState } from './vaultStoreTypes';

/**
 * Supported vault operation types
 */
export type VaultOperationType = 'borrow' | 'deposit' | 'repay' | 'withdraw';

/**
 * Store name mapping for log prefixes
 */
const storeNameMap: Record<VaultOperationType, string> = {
  borrow: 'BorrowStore',
  deposit: 'DepositStore',
  repay: 'RepayStore',
  withdraw: 'WithdrawStore',
};

/**
 * Context passed to extension functions so they can reference common state/actions
 */
export interface VaultStoreContext {
  /** The common initial state, for use in reset overrides */
  initialState: CommonVaultState;
  /** The store name, for logging */
  storeName: string;
}

/**
 * Extension function type: receives set, get, and common context; returns extra state/actions.
 * The returned object is merged on top of the common state/actions, so it can override `reset`.
 */
export type VaultStoreExtension<TExtension extends {}> = (
  set: StoreApi<CommonVaultState & CommonVaultActions & TExtension>['setState'],
  get: StoreApi<CommonVaultState & CommonVaultActions & TExtension>['getState'],
  context: VaultStoreContext
) => TExtension;

/**
 * Creates a Zustand store with common vault operation state and actions,
 * optionally extended with operation-specific state.
 *
 * @param operationType - The type of vault operation
 * @param extension - Optional function returning additional state/actions
 * @returns A Zustand store hook
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export function createVaultOperationStore<TExtension extends {} = {}>(
  operationType: VaultOperationType,
  extension?: VaultStoreExtension<TExtension>
): UseBoundStore<StoreApi<CommonVaultState & CommonVaultActions & TExtension>> {
  const storeName = storeNameMap[operationType];

  type FullStore = CommonVaultState & CommonVaultActions & TExtension;

  return create<FullStore>()((set, get) => {
    // Build common state and actions
    const common: CommonVaultState & CommonVaultActions = {
      // Initial state
      ...commonInitialState,

      // Fee actions
      setSelectedFeeRate: (selectedFeeRate: number) => {
        logger.debug(`[${storeName}] setSelectedFeeRate:`, selectedFeeRate);
        set({ selectedFeeRate } as Partial<FullStore>);
      },

      // Vault data actions
      setCurrentVaultData: (unitBorrowed: number, btcLocked: number) => {
        logger.debug(`[${storeName}] setCurrentVaultData:`, { unitBorrowed, btcLocked });
        set({
          currentUnitBorrowed: unitBorrowed,
          currentBtcLocked: btcLocked,
        } as Partial<FullStore>);
      },

      setBitcoinPrice: (bitcoinPrice: number | null) => {
        set({ bitcoinPrice } as Partial<FullStore>);
      },

      // Navigation
      setCurrentStep: (currentStep: VaultOperationStep) => {
        logger.debug(`[${storeName}] setCurrentStep:`, currentStep);
        set({ currentStep, error: null } as Partial<FullStore>);
      },

      setProcessingStep: (processingStep: ProcessingStep) => {
        logger.debug(`[${storeName}] setProcessingStep:`, processingStep);
        set({ processingStep } as Partial<FullStore>);
      },

      // Process actions
      setLoading: (loading: boolean) => {
        set({ loading } as Partial<FullStore>);
      },

      setError: (error: string | null) => {
        logger.debug(`[${storeName}] setError:`, error);
        set({ error, loading: false } as Partial<FullStore>);
      },

      setVaultTxid: (vaultTxid: string | null) => {
        logger.debug(`[${storeName}] setVaultTxid:`, vaultTxid);
        set({ vaultTxid } as Partial<FullStore>);
      },

      // Common computed getters
      getHealthFactor: () => {
        const { currentBtcLocked, currentUnitBorrowed, bitcoinPrice } = get();
        if (!bitcoinPrice || currentBtcLocked <= 0 || currentUnitBorrowed <= 0) return 0;
        return computeHealthFactor(currentBtcLocked, bitcoinPrice, currentUnitBorrowed);
      },

      getLiquidationPrice: () => {
        const { currentBtcLocked, currentUnitBorrowed } = get();
        if (currentBtcLocked <= 0 || currentUnitBorrowed <= 0) return 0;
        return computeLiquidationPrice(currentUnitBorrowed, currentBtcLocked);
      },

      getHealthStatus: () => {
        const healthFactor = (get() as CommonVaultState & CommonVaultActions).getHealthFactor();
        return getHealthStatus(healthFactor);
      },

      // Reset (may be overridden by extension)
      reset: () => {
        logger.debug(`[${storeName}] reset`);
        set(commonInitialState as Partial<FullStore>);
      },
    };

    // If no extension, return common only
    if (!extension) {
      return common as FullStore;
    }

    // Build extensions and merge (extensions can override common, e.g., reset)
    const context: VaultStoreContext = { initialState: commonInitialState, storeName };
    const ext = extension(set, get, context);

    return {
      ...common,
      ...ext,
    };
  });
}
