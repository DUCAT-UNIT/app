/**
 * Vault Operations Service
 * Re-exports all vault operation functions
 */

// Utility functions
export type { Utxo, VaultActionCode } from './utils';
export {
  readVarInt,
  extractOpReturnFromTxHex,
  checkBatchAllowed,
  normalizeMasterId,
  normalizeVaultAction,
  computeVaultPrevoutFromTx,
  buildVaultProfile,
} from './utils';

// Open operations
export type { CreateVaultReqOptions } from './open';
export {
  createVaultConfig,
  guardianOpenVaultReserve,
  createVaultReqOpen,
  guardianSendReqOpen,
} from './open';

// Borrow operations
export type { CreateBorrowReqOptions } from './borrow';
export {
  createBorrowConfig,
  guardianBorrowReserve,
  createVaultReqBorrow,
  guardianSendReqBorrow,
} from './borrow';

// Deposit operations
export type { CreateDepositReqOptions } from './deposit';
export {
  createDepositConfig,
  createVaultReqDeposit,
  guardianSendReqDeposit,
} from './deposit';

// Repay operations
export type { CreateRepayReqOptions } from './repay';
export {
  createRepayConfig,
  guardianRepayReserve,
  createVaultReqRepay,
  guardianSendReqRepay,
} from './repay';

// Withdraw operations
export type { CreateWithdrawReqOptions } from './withdraw';
export {
  createWithdrawConfig,
  createVaultReqWithdraw,
  guardianSendReqWithdraw,
} from './withdraw';
