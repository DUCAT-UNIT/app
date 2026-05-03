import type { LiquidationTerms, VaultProfile } from '../../../types/index.js';
export interface LiquidationConfig {
    coin_price: number;
    repo_portion?: number;
    sats_total: number;
    unit_total: number;
    unit_divisor?: number;
}
export interface LiquidVaultProfile extends VaultProfile {
    liquid_quote: LiquidationQuote;
    repo_portion: number;
    return_sats: number;
    return_unit: number;
    thold_key: string;
}
export interface LiquidationCtx {
    liquid_terms: LiquidationTerms;
    liquid_vaults: LiquidVaultProfile[];
    reserve_pk: string;
    reserve_sats: number;
    claimed_unit: number;
    claimed_sats: number;
    return_unit: number;
    return_sats: number;
    total_unit: number;
    total_sats: number;
    vault_count: number;
}
export interface LiquidationQuote {
    coin_price: number;
    deficit_cr: number;
    deficit_sats: number;
    liquid_nav: number;
    profit_margin: number;
    reserve_sats: number;
    reward_cr: number;
    reward_sats: number;
    sats_balance: number;
    subsidy_multi: number;
    subsidy_rate: number;
    subsidy_sats: number;
    taxable_sats: number;
    unit_balance: number;
    unit_divisor: number;
    vault_cr: number;
}
