import type { BreachedPriceContract, ProtoProfile, VaultProfile } from '../types/index.js';
export interface LiquidVaultConfig {
    breach_contracts: BreachedPriceContract[];
    liquid_price: number;
    proto_profile: ProtoProfile;
}
export interface LiquidationQuote {
    claimed_sats: number;
    claimed_unit: number;
    deficit_ratio: number;
    deficit_sats: number;
    reserve_rate: number;
    reserve_sats: number;
    reward_ratio: number;
    reward_sats: number;
    subsidy_multi: number;
    subsidy_rate: number;
}
export interface LiquidVaultProfile extends VaultProfile, LiquidationQuote {
    liquid_key: string;
    liquid_price: number;
}
export interface LiquidVaultTotal {
    claimed_unit: number;
    deficit_sats: number;
    reserve_sats: number;
    return_sats: number;
    return_unit: number;
    reward_sats: number;
}
export interface LiquidationManifest {
    cleared_vaults: LiquidVaultProfile[] | null;
    cleared_total: LiquidVaultTotal | null;
    trimmed_vault: LiquidVaultProfile | null;
    trimmed_total: LiquidVaultTotal | null;
    total_unit_claimed: number;
    total_sats_deficit: number;
    total_sats_reward: number;
}
