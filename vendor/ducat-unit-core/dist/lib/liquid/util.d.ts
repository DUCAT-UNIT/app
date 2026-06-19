import type { BreachedPriceContract, LiquidVaultProfile, ProtoProfile, VaultProfile, PriceContract } from '../../types/index.js';
export declare function get_vault_breach_contract(proto_profile: ProtoProfile, price_contracts: PriceContract[], vault_profile: VaultProfile): BreachedPriceContract | null;
export declare function get_vault_liquidation_key(proto_profile: ProtoProfile, price_contracts: PriceContract[], vault_profile: VaultProfile): string | null;
export declare function select_liquid_vaults(liquid_vaults: LiquidVaultProfile[], recap_limit?: number): LiquidVaultProfile[];
export declare function get_recap_costs_total(liquid_vaults: LiquidVaultProfile[]): number;
