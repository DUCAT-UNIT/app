import type { WalletVaultBorrowConfig, WalletVaultDepositConfig, WalletVaultOpenConfig, WalletVaultRepayConfig, WalletVaultRepoConfig, WalletVaultWithdrawConfig } from '../../../types/index.js';
export declare function verify_vault_open_config(config: unknown): asserts config is WalletVaultOpenConfig;
export declare function verify_vault_borrow_config(config: unknown): asserts config is WalletVaultBorrowConfig;
export declare function verify_vault_repay_config(config: unknown): asserts config is WalletVaultRepayConfig;
export declare function verify_vault_deposit_config(config: unknown): asserts config is WalletVaultDepositConfig;
export declare function verify_vault_withdraw_config(config: unknown): asserts config is WalletVaultWithdrawConfig;
export declare function verify_vault_repo_config(config: unknown): asserts config is WalletVaultRepoConfig;
