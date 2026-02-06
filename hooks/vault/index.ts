/**
 * Vault Hooks Module
 *
 * Unified vault operation hooks that consolidate the common patterns
 * from borrow, deposit, repay, and withdraw operations.
 *
 * This module reduces ~1,400 lines of duplicated code across 4 hooks
 * into a single ~200 line base hook with ~50 line config wrappers.
 */

// Base hook
export { useVaultOperation } from './useVaultOperation';

// Types
export type {
  VaultOperationType,
  ProcessingStep,
  VaultWalletData,
  VaultContextData,
  VaultStoreState,
  VaultStoreActions,
  VaultStore,
  VaultOperationConfig,
  VaultValidationParams,
  VaultRequestParams,
  LiquidationPriceParams,
  PendingTransactionParams,
  PendingVaultTransaction,
  UseVaultOperationResult,
} from './vaultOperationTypes';

// Operation-specific hooks (new implementations)
export { useBorrowVaultNew, useBorrow } from './useBorrowVaultNew';
export type { UseBorrowVaultResult } from './useBorrowVaultNew';

export { useDepositVaultNew, useDeposit } from './useDepositVaultNew';
export type { UseDepositVaultResult } from './useDepositVaultNew';

export { useRepayVaultNew, useRepay } from './useRepayVaultNew';
export type { UseRepayVaultResult } from './useRepayVaultNew';

export { useWithdrawVaultNew, useWithdraw } from './useWithdrawVaultNew';
export type { UseWithdrawVaultResult } from './useWithdrawVaultNew';
