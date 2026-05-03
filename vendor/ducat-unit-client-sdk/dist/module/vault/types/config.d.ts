import type { VaultTokenData } from '../../../types/index.js';
interface VaultBaseConfig {
    sats_address: string;
    tx_feerate: number;
}
export interface VaultFeeOptions {
    coin_count?: number;
    coin_type?: 'p2sh' | 'p2w-pkh' | 'p2tr';
    padding?: number;
}
export interface VaultOpenConfig extends VaultBaseConfig {
    borrow_amount: number;
    deposit_amount: number;
    token_address: string;
    token_data: VaultTokenData;
    token_postage: number;
    unit_address: string;
    unit_postage: number;
    vault_pubkey: string;
}
export interface VaultBorrowConfig extends VaultBaseConfig {
    borrow_amount: number;
    deposit_amount: number;
    unit_address: string;
    unit_postage: number;
}
export interface VaultRepayConfig extends VaultBaseConfig {
    deposit_amount: number;
    repay_amount: number;
    unit_address: string;
    unit_postage: number;
}
export interface VaultRepoConfig extends VaultBaseConfig {
    deposit_amount: number;
}
export interface VaultDepositConfig extends VaultBaseConfig {
    deposit_amount: number;
}
export interface VaultWithdrawConfig extends VaultBaseConfig {
    change_amount: number;
}
export {};
