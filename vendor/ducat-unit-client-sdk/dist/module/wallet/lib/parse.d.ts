import type { WalletVaultBorrowConfig, WalletVaultDepositConfig, WalletVaultOpenConfig, WalletVaultRepayConfig, WalletVaultRepoConfig, WalletVaultWithdrawConfig } from '../../../types/index.js';
export declare namespace WalletParser {
    function open_config(config: unknown): WalletVaultOpenConfig;
    function borrow_config(config: unknown): WalletVaultBorrowConfig;
    function repay_config(config: unknown): WalletVaultRepayConfig;
    function repo_config(config: unknown): WalletVaultRepoConfig;
    function deposit_config(config: unknown): WalletVaultDepositConfig;
    function withdraw_config(config: unknown): WalletVaultWithdrawConfig;
}
