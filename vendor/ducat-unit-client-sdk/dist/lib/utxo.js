import CONST from '../const.js';
const RANDOM_SORT = () => Math.random() > 0.5 ? 1 : -1;
export function select_sat_utxos(utxos, amount, sorter = RANDOM_SORT) {
    const selected = [];
    let total = 0;
    utxos.sort(sorter);
    for (const utxo of utxos) {
        selected.push(utxo);
        total += utxo.value;
        if (total > amount + CONST.DUST_LIMIT) {
            return selected;
        }
    }
    throw new Error(`insufficient sats: ${total} < ${amount}`);
}
export function select_rune_utxos(utxos, rune, amount, sorter = RANDOM_SORT) {
    const selected = [];
    let total = 0;
    utxos.sort(sorter);
    for (const utxo of utxos) {
        const rdata = utxo.runes.get(rune);
        if (rdata === undefined)
            continue;
        if (rdata.amount < 1)
            continue;
        selected.push(utxo);
        total += rdata.amount;
        if (total >= amount) {
            return selected;
        }
    }
    throw new Error(`insufficient funds for "${rune}" rune: ${total} < ${amount}`);
}
export function filter_rune_utxos(utxos, rune) {
    let filtered = [];
    for (const utxo of utxos) {
        const rdata = utxo.runes.get(rune);
        if (rdata === undefined)
            continue;
        filtered.push(utxo);
    }
    return filtered;
}
export function sum_rune_utxos(utxos, rune) {
    let total = 0;
    for (const utxo of utxos) {
        const rdata = utxo.runes.get(rune);
        if (rdata === undefined)
            continue;
        total += rdata.amount;
    }
    return total;
}
