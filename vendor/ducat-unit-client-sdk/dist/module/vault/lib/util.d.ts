import type { TermsMap, Literal, PointerKeys, VaultFeeOptions, BaseUtxo, LiquidationTerms, VaultTerms } from '../../../types/index.js';
export declare function get_term_arr(terms: TermsMap, key: PointerKeys): Literal[];
export declare function get_term(terms: TermsMap, key: PointerKeys): Literal;
export declare function parse_liquidation_terms(map: Map<string, Literal[]>): LiquidationTerms;
export declare function parse_vault_terms(map: Map<string, Literal[]>): VaultTerms;
export declare function get_coin_size(type: string): number;
export declare function get_estimated_spend_size(spend_options?: VaultFeeOptions): number;
export declare function get_actual_spend_size(utxos: BaseUtxo[]): number;
