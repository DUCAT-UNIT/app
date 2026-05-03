import type { TxData } from '@scrow/tapscript';
import type { BaseUtxo, VaultTokenData } from '../../../types/index.js';
export declare function parse_vault_tx(tx: string | TxData): {
    vault_data: import("../../../types/index.js").VaultReturnData;
    vault_utxo: BaseUtxo;
};
export declare function get_vault_token_vsize(token: VaultTokenData): number;
export declare function get_max_unit_issuable(min_cr_ratio: number, oracle_quote: number, unit_balance: number, vault_sats: number): number;
export declare function calc_issuance_tx_cost(fund_utxos: BaseUtxo[], postage: number, tx_feerate: number): number;
export declare function calc_liquidate_tx_cost(fund_utxos: BaseUtxo[], tx_feerate: number, vault_count: number): number;
