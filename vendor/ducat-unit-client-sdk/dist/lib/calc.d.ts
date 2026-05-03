export declare function calc_portion(amount: number, percent?: number): number;
export declare function convert_sats_to_btc(sats_amount: number): number;
export declare function convert_btc_to_sats(btc_amount: number): number;
export declare function convert_sats_to_unit(sats_amount: number, coin_price: number): number;
export declare function convert_unit_to_sats(unit_amount: number, coin_price: number): number;
export declare function calc_collateral_ratio(sats_amount: number, unit_amount: number, coin_price: number): number;
export declare function calc_collateral_value(coll_ratio: number, unit_amount: number, unit_rate: number): number;
