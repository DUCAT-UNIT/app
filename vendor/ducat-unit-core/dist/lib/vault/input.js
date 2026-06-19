import { VAULT_SEQUENCE_VERSION, SYMBOLS } from '../../const.js';
import { get_coin_input, encode_sequence, get_vault_action_code } from '../../lib/index.js';
export function create_meta_input(seq_code, tx_input) {
    const config = {
        code: seq_code,
        type: 'metadata',
        version: VAULT_SEQUENCE_VERSION
    };
    const sequence = encode_sequence(config);
    return get_coin_input({ ...tx_input, sequence });
}
export function create_vault_action_input(coin_utxo, vault_action) {
    const code = get_vault_action_code(vault_action);
    return create_meta_input(code, coin_utxo);
}
export function create_vault_connector_input(coin_utxo) {
    const code = SYMBOLS.CODE.INPUT.CONNECT;
    return create_meta_input(code, coin_utxo);
}
export function create_unit_asset_input(coin_utxo) {
    const code = SYMBOLS.CODE.ASSET.UNIT;
    return create_meta_input(code, coin_utxo);
}
export function create_liquid_vault_input(coin_utxo) {
    const code = SYMBOLS.CODE.INPUT.LIQUID;
    return create_meta_input(code, coin_utxo);
}
