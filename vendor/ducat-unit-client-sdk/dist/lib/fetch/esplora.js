import { Assert, Fetch, Resolve } from '@vbyte/util';
import { get_address_script } from '../../module/vault/index.js';
import { safe_path_segment } from './util.js';
import * as SCHEMA from '../../schema/index.js';
export async function fetch_esplora_tx(host_url, txid) {
    Assert.is_hash(txid);
    const url = `${host_url}/tx/${txid}`;
    const res = await Fetch.json(url);
    if (!res.ok)
        return res;
    const schema = SCHEMA.esplora.tx_data;
    const parsed = schema.safeParse(res.data);
    if (!parsed.success)
        return Resolve.error(parsed.error, 600);
    return Resolve.data(parsed.data);
}
export async function fetch_esplora_utxos(host_url, address) {
    const seg = safe_path_segment(address, 'address');
    const url = `${host_url}/address/${seg}/utxo`;
    const res = await Fetch.json(url);
    if (!res.ok)
        return res;
    const schema = SCHEMA.esplora.address_utxo.array();
    const parsed = schema.safeParse(res.data);
    if (!parsed.success)
        return Resolve.error(parsed.error, 600);
    const script_pk = get_address_script(address).hex;
    const utxos = parsed.data.map(e => ({ ...e, script_pk }));
    return Resolve.data(utxos);
}
export async function post_esplora_tx(host_url, txhex) {
    Assert.is_hex(txhex);
    const url = `${host_url}/tx`;
    const opt = { body: txhex, method: 'POST' };
    return Fetch.text(url, opt);
}
