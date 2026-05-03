export interface WalletVaultOpenConfig {
    borrow_amount: number;
    deposit_amount: number;
    tx_feerate: number;
    vault_label: string;
}
export interface WalletVaultBorrowConfig {
    borrow_amount: number;
    deposit_amount: number;
    tx_feerate: number;
}
export interface WalletVaultRepoConfig {
    deposit_amount: number;
    tx_feerate: number;
}
export interface WalletVaultRepayConfig {
    deposit_amount: number;
    repay_amount: number;
    tx_feerate: number;
}
export interface WalletVaultDepositConfig {
    deposit_amount: number;
    tx_feerate: number;
}
export interface WalletVaultWithdrawConfig {
    change_amount: number;
    tx_feerate: number;
}
