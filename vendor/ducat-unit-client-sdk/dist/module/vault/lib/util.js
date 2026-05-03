import { Assert, get_map_value } from '../../../util/index.js';
import { parse_script_meta } from '../../../util/tx.js';
import CONST from '../../../const.js';
import Schema from '../../../schema/index.js';
export function get_term_arr(terms, key) {
    const arr = terms.get(key);
    Assert.exists(arr, 'protocol term undefined: ' + key);
    return arr;
}
export function get_term(terms, key) {
    const term = get_term_arr(terms, key).at(0);
    Assert.exists(term, 'protocol term undefined: ' + key);
    return term;
}
export function parse_liquidation_terms(map) {
    return Schema.proto.liquid_terms.parse({
        liquidation_thold: get_map_value(map, 'repo_liquidation_thold'),
        reserve_pubkey: get_map_value(map, 'repo_reserve_pubkey'),
        reserve_sats_min: get_map_value(map, 'repo_reserve_sats_min'),
        liquid_tax_rate: get_map_value(map, 'repo_liquid_tax_rate'),
        subsidy_inc_rate: get_map_value(map, 'repo_subsidy_inc_rate'),
        subsidy_inc_thold: get_map_value(map, 'repo_subsidy_inc_thold')
    });
}
export function parse_vault_terms(map) {
    return Schema.proto.vault_terms.parse({
        collateral_min: get_map_value(map, 'vault_collateral_min'),
        internal_key: get_map_value(map, 'vault_internal_key'),
        sats_balance_min: get_map_value(map, 'vault_sats_balance_min'),
        unit_balance_min: get_map_value(map, 'vault_unit_balance_min')
    });
}
export function get_coin_size(type) {
    switch (type) {
        case 'p2sh':
            return CONST.TXSIZE.TXIN.P2SH;
        case 'p2w-pkh':
            return CONST.TXSIZE.TXIN.P2WK;
        case 'p2tr':
            return CONST.TXSIZE.TXIN.P2TR;
        default:
            throw new Error('unsupported input type: ' + type);
    }
}
export function get_estimated_spend_size(spend_options = {}) {
    const { coin_count = 1, coin_type = 'p2w-pkh', padding = 0 } = spend_options;
    return get_coin_size(coin_type) * coin_count + padding;
}
export function get_actual_spend_size(utxos) {
    let size = 0;
    for (const utxo of utxos) {
        const ctx = parse_script_meta(utxo.script);
        size += get_coin_size(ctx.type);
    }
    return size;
}
