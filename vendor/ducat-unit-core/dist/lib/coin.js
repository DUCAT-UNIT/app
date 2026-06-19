import { Assert } from '@vbyte/util/assert';
import { RANDOM_SORT } from './random.js';
import { DUST_LIMIT } from '../const.js';
const MAX_SEQUENCE = 0xFFFFFFFF;
export function get_coin_total_value(coin_utxos) {
    return coin_utxos.reduce((prev, curr) => prev + curr.value, 0);
}
export function select_coins(coins, amount) {
    const selected = [];
    let total = 0;
    coins.sort(RANDOM_SORT);
    for (const coin of coins) {
        selected.push(coin);
        total += coin.value;
        if (total >= amount)
            break;
    }
    Assert.ok(total >= amount, `insufficient funds: ${total} < ${amount}`);
    Assert.ok(total >= DUST_LIMIT, `funds below dust limit: ${total} < ${DUST_LIMIT}`);
    return selected;
}
export function get_coin_utxo(txdata, index) {
    if (index < 0)
        return null;
    const utxo = txdata.vout.at(index);
    if (utxo === undefined)
        return null;
    return {
        script_pk: utxo.script_pk,
        txid: txdata.txid,
        value: utxo.value,
        vout: index
    };
}
export function get_coin_input(template) {
    return {
        ...template,
        sequence: template.sequence ?? MAX_SEQUENCE,
        witness: template.witness ?? []
    };
}
