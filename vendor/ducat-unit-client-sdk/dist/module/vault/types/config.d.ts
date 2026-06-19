import type { VaultActionConfig } from '../../../types/index.js';
import type { AssetAccount, LiquidVaultProfile, PriceContract, VaultConfigData, VaultProfile } from '@ducat-unit/core';
export interface VaultValidationOptions {
    warn_only_high_fees?: boolean;
    low_feerate_tolerance?: number;
}
export interface VaultBaseRequestConfig extends VaultActionConfig {
    change_address?: string;
    client_pubkey?: string;
    guard_pubkey: string;
    issue_account?: AssetAccount;
    price_contracts?: PriceContract[];
    unit_address?: string;
    vault_config?: VaultConfigData;
    validation_options?: VaultValidationOptions;
}
export interface VaultOpenRequestConfig extends VaultBaseRequestConfig {
    borrow_amount: number;
    client_pubkey: string;
    issue_account: AssetAccount;
    unit_address: string;
    unit_postage: number;
    vault_action: 'open';
}
export interface VaultBorrowRequestConfig extends VaultBaseRequestConfig {
    issue_account: AssetAccount;
    borrow_amount: number;
    unit_address: string;
    unit_postage: number;
    vault_action: 'borrow';
    vault_profile: VaultProfile;
}
export interface VaultRepayRequestConfig extends VaultBaseRequestConfig {
    repay_amount: number;
    vault_action: 'repay';
    vault_profile: VaultProfile;
}
export interface VaultDepositRequestConfig extends VaultBaseRequestConfig {
    deposit_amount: number;
    vault_action: 'deposit';
    vault_profile: VaultProfile;
}
export interface VaultWithdrawRequestConfig extends VaultBaseRequestConfig {
    change_address: string;
    vault_action: 'withdraw';
    vault_profile: VaultProfile;
    withdraw_amount: number;
}
export interface VaultCloseRequestConfig extends VaultBaseRequestConfig {
    change_address: string;
    vault_action: 'close';
    vault_profile: VaultProfile;
}
export interface VaultRepoRequestConfig extends VaultBaseRequestConfig {
    liquid_profiles: LiquidVaultProfile[];
    price_contracts: PriceContract[];
    vault_action: 'repo';
    vault_profile: VaultProfile;
}
export interface VaultTrimRequestConfig extends VaultBaseRequestConfig {
    liquid_profiles: LiquidVaultProfile[];
    price_contracts: PriceContract[];
    vault_action: 'trim';
    vault_profile: VaultProfile;
}
