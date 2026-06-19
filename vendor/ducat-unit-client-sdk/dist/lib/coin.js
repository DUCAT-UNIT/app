import { Assert } from '@vbyte/util/assert';
import { get_lock_script_type } from '@vbyte/btc-dev/script';
import { get_coin_total_value } from '@ducat-unit/core/lib';
import { TXSIZE } from '../const.js';
export const FUNDS_CTX = {
    coin_count: 0,
    coin_fees: 0,
    coin_size: 0,
    coin_value: 0
};
export function get_coin_size(coin) {
    const type = get_lock_script_type(coin.script_pk);
    Assert.exists(type, `unsupported coin type: ${coin.script_pk}`);
    switch (type) {
        case 'p2wpkh': return TXSIZE.VIN_P2WPKH_SPEND_SIZE;
        case 'p2tr': return TXSIZE.VIN_P2TR_SPEND_SIZE;
        default: throw new Error(`unsupported coin type: ${type}`);
    }
}
export function get_coin_total_size(coin_utxos) {
    let total_size = 0;
    for (const coin of coin_utxos) {
        total_size += get_coin_size(coin);
    }
    return total_size;
}
export function get_coin_ctx(coin_inputs, txfee_rate) {
    if (coin_inputs.length === 0)
        return FUNDS_CTX;
    const coin_count = coin_inputs.length;
    const coin_size = get_coin_total_size(coin_inputs);
    const coin_value = get_coin_total_value(coin_inputs);
    const coin_fees = coin_size * txfee_rate;
    return { coin_count, coin_fees, coin_size, coin_value };
}
