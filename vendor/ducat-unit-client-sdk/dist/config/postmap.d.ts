export type PointerKeys = 'repo_liquidation_thold' | 'repo_reserve_pubkey' | 'repo_reserve_sats_min' | 'repo_liquid_tax_rate' | 'repo_subsidy_inc_rate' | 'repo_subsidy_inc_thold' | 'vault_sats_balance_min' | 'vault_unit_balance_min' | 'vault_collateral_min' | 'vault_internal_key';
export type PostageKeys = 'master' | 'guard_hosts' | 'guard_group' | 'unit_account' | 'unit_reserve' | 'vault_terms' | 'vault_point' | 'oracle_hosts' | 'oracle_group' | 'vault_token' | 'repo_terms' | 'repo_point';
export declare namespace POINTER {
    const KEYS: PointerKeys[];
    const RANGE: number[];
    const TYPES: Record<number, PointerKeys>;
    const GET_KEY: (type: number) => string;
    const GET_TYPE: (key: PointerKeys) => number;
}
export declare namespace POSTAGE {
    const KEYS: PostageKeys[];
    const RANGE: number[];
    const TYPES: Record<number, PostageKeys>;
    const GET_KEY: (type: number) => string;
    const GET_TYPE: (key: PostageKeys) => number;
}
declare const _default: {
    POINTER: typeof POINTER;
    POSTAGE: typeof POSTAGE;
};
export default _default;
