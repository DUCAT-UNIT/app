import { esplora_get_utxos } from './esplora.js';
import { parse_outpoint_sat } from '../lib/ord.js';
import { Assert, OrdUtil, Resolve, sleep } from '../../../util/index.js';
import { ord_fetch_content, ord_fetch_sat_identifier, ord_fetch_inscription, ord_fetch_outpoint } from './ord.js';
import * as CONFIG from '../config.js';
const { FETCH_CONFIG, SAT_IDX } = CONFIG;
const RANDOM_IDX = (max) => {
    return Math.floor(Math.random() * 1000) % max;
};
export async function fetch_record_id(ord_url, sat_ptr, index = SAT_IDX) {
    const res = await ord_fetch_sat_identifier(ord_url, sat_ptr, index);
    if (!res.ok)
        return res;
    return (res.data !== null)
        ? Resolve.data(res.data)
        : Resolve.fail('sat pointer returned null', 404);
}
export async function fetch_record_content(ord_url, identifier, schema) {
    const res = await ord_fetch_content(ord_url, identifier);
    if (!res.ok)
        return res;
    return (schema !== undefined)
        ? Resolve.schema(res.data, schema)
        : Resolve.data(res.data);
}
export async function fetch_outpoint_sat(ord_url, outpoint) {
    const res = await ord_fetch_outpoint(ord_url, outpoint);
    if (!res.ok)
        return res;
    const sat = parse_outpoint_sat(res.data);
    return (sat !== null)
        ? Resolve.data(sat)
        : Resolve.fail('sat pointer returned null', 404);
}
export async function fetch_satpoint_meta(ord_url, pointer, options) {
    const { index, ival } = { ...FETCH_CONFIG, ...options };
    const res1 = await fetch_record_id(ord_url, pointer, index);
    if (!res1.ok)
        return res1;
    await sleep(ival);
    return ord_fetch_inscription(ord_url, res1.data);
}
export async function fetch_satpoint_content(ord_url, pointer, options) {
    const { index, ival, schema } = { ...FETCH_CONFIG, ...options };
    const res1 = await fetch_record_id(ord_url, pointer, index);
    if (!res1.ok)
        return res1;
    await sleep(ival);
    return fetch_record_content(ord_url, res1.data, schema);
}
export async function fetch_outpoint_groups(esp_url, address, postage) {
    const res = await esplora_get_utxos(esp_url, address, postage);
    if (!res.ok)
        return res;
    const groups = new Map();
    for (const utxo of res.data) {
        const { txid, value, vout } = utxo;
        if (postage.includes(value)) {
            const group = groups.get(value) ?? [];
            group.push(`${txid}:${vout}`);
            groups.set(value, group);
        }
    }
    return Resolve.data(groups);
}
export async function fetch_outpoint_group(esp_url, address, postage) {
    const res = await fetch_outpoint_groups(esp_url, address, [postage]);
    if (!res.ok)
        return res;
    const arr = res.data.get(postage) ?? [];
    return Resolve.data(arr);
}
export async function fetch_outpoint_range(esp_url, address, range) {
    const res = await esplora_get_utxos(esp_url, address);
    if (!res.ok)
        return res;
    const entries = new Map();
    for (const utxo of res.data) {
        const { txid, value, vout } = utxo;
        if (range[0] <= value && value <= range[1]) {
            entries.set(value, `${txid}:${vout}`);
        }
    }
    return Resolve.data(entries);
}
export async function fetch_rand_outpoint(esp_url, address, postage) {
    const res = await fetch_outpoint_group(esp_url, address, postage);
    if (!res.ok)
        return res;
    const idx = RANDOM_IDX(res.data.length);
    const out = res.data.at(idx);
    Assert.exists(out, 'invalid index for outpoint group: ' + idx);
    return Resolve.data(out);
}
export async function fetch_outpoint_id(ord_url, outpoint, options) {
    const conf = { ...FETCH_CONFIG, ...options };
    const res = await fetch_outpoint_sat(ord_url, outpoint);
    if (!res.ok)
        return res;
    await sleep(conf.ival);
    return fetch_record_id(ord_url, res.data);
}
export async function fetch_outpoint_meta(ord_url, outpoint, options) {
    const conf = { ...FETCH_CONFIG, ...options };
    const res = await fetch_outpoint_sat(ord_url, outpoint);
    if (!res.ok)
        return res;
    await sleep(conf.ival);
    return fetch_satpoint_meta(ord_url, res.data, conf);
}
export async function fetch_outpoint_content(ord_url, outpoint, options) {
    const conf = { ...FETCH_CONFIG, ...options };
    const res = await fetch_outpoint_sat(ord_url, outpoint);
    if (!res.ok)
        return res;
    await sleep(conf.ival);
    return fetch_satpoint_content(ord_url, res.data, conf);
}
export async function fetch_rune_utxo(ord_url, outpoint) {
    OrdUtil.assert_outpoint(outpoint);
    const [txid, vout] = OrdUtil.parse_outpoint(outpoint);
    const res = await ord_fetch_outpoint(ord_url, outpoint);
    if (!res.ok) {
        return res;
    }
    else if (res.data.runes === null) {
        return Resolve.fail('no runes found', 404);
    }
    else {
        const records = res.data.inscriptions;
        const runes = new Map(Object.entries(res.data.runes));
        const script = res.data.script_pubkey;
        const value = res.data.value;
        return Resolve.data({ records, runes, script, txid, value, vout });
    }
}
