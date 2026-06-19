import type { VaultTerms } from '../../types/index.js';
export declare function get_liquid_sats_portion(repo_amount: number, sats_balance: number, unit_balance: number): number;
export declare function calc_liquid_tax_rate(vault_terms: VaultTerms): number;
export declare function calc_liquid_rev_rate(vault_terms: VaultTerms, coll_ratio: number): number;
export declare function calc_liquid_subsidy_multiplier(vault_terms: VaultTerms, coll_ratio: number): number;
export declare function calc_liquid_subsidy_rate(vault_terms: VaultTerms, subsidy_multi: number): number;
export declare function calc_liquid_reserve_rate(tax_rate: number, subsidy_rate: number): number;
export declare function calc_liquid_reserve_sats(vault_terms: VaultTerms, reserve_rate: number, sats_balance: number): number;
