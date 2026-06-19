export interface EffectiveSizeConfig {
    tx_vsize: number;
    sigops_count: number;
    package_vsize?: number;
}
export declare function get_effective_vsize(config: EffectiveSizeConfig): number;
export declare function get_effective_feerate(fees: number, config: EffectiveSizeConfig): number;
export declare function get_min_feerate(txfee_rate: number, tolerance?: number): number;
