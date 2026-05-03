import { Buff } from '@cmdcode/buff';
import { get_vsize } from '../../../lib/util.js';
import { parse_vault_return } from './rdata.js';
import { get_actual_spend_size } from './util.js';
import CONST from '../../../const.js';
import TX from '../../../util/tx.js';
export function parse_vault_tx(tx) {
    const vault_utxo = TX.extract_utxo(tx, 0);
    const vault_return = TX.extract_op_return(tx);
    const vault_data = parse_vault_return(vault_return);
    return { vault_data, vault_utxo };
}
export function get_vault_token_vsize(token) {
    const str = JSON.stringify(token, null, 2);
    const bytes = Buff.str(str);
    return get_vsize(bytes);
}
export function get_max_unit_issuable(min_cr_ratio, oracle_quote, unit_balance, vault_sats) {
    const collateral_unit_value = (vault_sats / 100_000_000) * oracle_quote;
    const max_allowable_unit = collateral_unit_value / min_cr_ratio;
    const max_available_unit = max_allowable_unit - unit_balance;
    return (max_available_unit > 0) ? max_available_unit : 0;
}
export function calc_issuance_tx_cost(fund_utxos, postage, tx_feerate) {
    const base_tx_size = CONST.TXSIZE.TX.GUARD_ACCOUNT;
    const txin_spend_size = get_actual_spend_size(fund_utxos);
    const total_tx_size = base_tx_size + txin_spend_size;
    return (postage + (total_tx_size * tx_feerate));
}
export function calc_liquidate_tx_cost(fund_utxos, tx_feerate, vault_count) {
    const base_tx_size = CONST.TXSIZE.TX.VAULT_LIQUID;
    const repo_vault_size = CONST.TXSIZE.TXIO.LIQUID_VAULT;
    const total_vault_size = repo_vault_size * vault_count;
    const txin_spend_size = get_actual_spend_size(fund_utxos);
    const total_tx_size = base_tx_size + total_vault_size + txin_spend_size;
    return total_tx_size * tx_feerate;
}
