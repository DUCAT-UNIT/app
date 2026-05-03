import { esplora_get_utxos } from './esplora.js';
import { ord_fetch_address } from './ord.js';
import { fetch_vault_token } from './vault.js';
import { Resolve, sleep, TX } from '../../../util/index.js';
import { fetch_outpoint_group, fetch_rune_utxo } from './ordx.js';
import CONST from '../../../const.js';
const { FETCH_IVAL } = CONST;
const DEFAULT_CONFIG = () => {
    return {
        cache: new Map(),
        ival: FETCH_IVAL
    };
};
export async function fetch_address_bal(ord_url, address) {
    const res = await ord_fetch_address(ord_url, address);
    if (!res.ok)
        return res;
    const runes = res.data.runes_balances.map(e => {
        return [e[0], Number(e[1])];
    });
    const rune_bal = new Map(runes);
    const sats_bal = res.data.sat_balance;
    return Resolve.data({ rune_bal, sats_bal });
}
export async function fetch_sats_utxos(esp_url, address) {
    const res = await esplora_get_utxos(esp_url, address);
    if (!res.ok)
        return res;
    const script = TX.parse_address_script(address).hex;
    const utxos = res.data.map(({ txid, value, vout }) => {
        return { script, txid, value, vout };
    });
    return Resolve.data(utxos);
}
export async function fetch_rune_utxos(ord_url, address, options = {}) {
    const { cache, ival } = { ...DEFAULT_CONFIG(), ...options };
    const res1 = await ord_fetch_address(ord_url, address);
    if (!res1.ok)
        return res1;
    for (const outpoint of res1.data.outputs) {
        if (cache.has(outpoint))
            continue;
        await sleep(ival);
        const res = await fetch_rune_utxo(ord_url, outpoint);
        if (!res.ok)
            continue;
        cache.set(outpoint, res.data);
    }
    return Resolve.data(cache);
}
export async function fetch_vault_tokens(esp_url, ord_url, address, postage, options = {}) {
    const { cache, ival } = { ...DEFAULT_CONFIG(), ...options };
    const res1 = await fetch_outpoint_group(esp_url, address, postage);
    if (!res1.ok)
        return res1;
    for (const outpoint of res1.data) {
        if (cache.has(outpoint))
            continue;
        await sleep(ival);
        const res = await fetch_vault_token(ord_url, outpoint, ival);
        if (!res.ok) {
            continue;
        }
        cache.set(outpoint, res.data);
    }
    return Resolve.data(cache);
}
