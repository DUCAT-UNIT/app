import type { PriceCommitData, PriceContract, PriceQuote, PriceObservation } from '../../types/index.js';
export declare function get_threshold_price(price_quote: PriceQuote, base_rate: number): number;
export declare function get_base_price_config(price_quote: PriceQuote): PriceObservation;
export declare function select_base_price_quote(price_quotes: PriceQuote[]): PriceQuote | null;
export declare function select_base_price_contract(price_contracts: PriceContract[]): PriceContract | null;
export declare function select_base_price_commit(price_commits: PriceCommitData[]): PriceCommitData | null;
