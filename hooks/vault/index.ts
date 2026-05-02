/**
 * Vault Hooks Module
 *
 * Unified vault operation hooks built on a shared base hook.
 */

// Base hook
export { useVaultOperation } from './useVaultOperation';

// Types
export type {
  VaultOperationType,
  ProcessingStep,
  VaultWalletData,
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

// Operation hooks
export { useBorrowVault, useBorrow } from './useBorrowVault';
export type { UseBorrowVaultResult } from './useBorrowVault';
export { useBorrowToUsdcSettlement } from './useBorrowToUsdcSettlement';
export type { UseBorrowToUsdcSettlementResult } from './useBorrowToUsdcSettlement';

export { useDepositVault, useDeposit } from './useDepositVault';
export type { UseDepositVaultResult } from './useDepositVault';

export { useRepayVault, useRepay } from './useRepayVault';
export type { UseRepayVaultResult } from './useRepayVault';
export { useRepayFromUsdcSettlement } from './useRepayFromUsdcSettlement';
export type { UseRepayFromUsdcSettlementResult } from './useRepayFromUsdcSettlement';

export { useWithdrawVault, useWithdraw } from './useWithdrawVault';
export type { UseWithdrawVaultResult } from './useWithdrawVault';
