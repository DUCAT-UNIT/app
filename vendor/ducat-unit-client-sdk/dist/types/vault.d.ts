import type { ObserveContext, ObservabilityOptions } from '../lib/observe/index.js';
import type { AssetAccount, CoinUtxo, LiquidVaultProfile, PriceQuote, ProtoProfile, VaultAction, VaultConfigData, VaultProfile } from '@ducat-unit/core';
export interface VaultActionConfig {
    asset_inputs?: AssetAccount[];
    borrow_amount?: number;
    deposit_amount?: number;
    fund_inputs?: CoinUtxo[];
    guard_members?: string[];
    liquid_profiles?: LiquidVaultProfile[];
    observability?: ObservabilityOptions | ObserveContext;
    price_quotes?: PriceQuote[];
    proto_profile: ProtoProfile;
    repay_amount?: number;
    txfee_rate: number;
    txfee_reserve?: number;
    unit_postage?: number;
    vault_action: VaultAction;
    vault_config?: VaultConfigData;
    vault_profile?: VaultProfile;
    withdraw_amount?: number;
}
export interface VaultActionBalance {
    unit_balance: number;
    vault_balance: number;
}
export interface VaultActionContext {
    guardian_count: number;
    liquid_count: number;
    oracle_count: number;
    reserve_balance: number;
    unit_balance: number;
}
export interface VaultFundsContext {
    coin_count: number;
    coin_fees: number;
    coin_size: number;
    coin_value: number;
}
export interface VaultActionEstimate extends VaultActionContext {
    action_effective_vsize: number;
    action_fees: number;
    action_postage: number;
    action_sigops_vsize: number;
    action_value: number;
    action_vsize: number;
}
export interface VaultActionQuote extends VaultActionEstimate, VaultFundsContext {
    change_value: number;
    fund_balance: number;
    overflow_value: number;
    total_cost: number;
    txfee_balance: number;
    vault_balance: number;
}
