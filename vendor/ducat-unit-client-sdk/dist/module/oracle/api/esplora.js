import { Assert, Fetch, Resolve } from '../../../util/index.js';
export async function esplora_get_tx(esplora_url, txid) {
    Assert.is_hash(txid);
    const url = `${esplora_url}/tx/${txid}`;
    return Fetch.json(url);
}
export async function esplora_get_address_data(esplora_url, address) {
    const url = `${esplora_url}/address/${address}`;
    return Fetch.json(url);
}
export async function esplora_get_utxos(esplora_url, address, filter) {
    const url = `${esplora_url}/address/${address}/utxo`;
    const res = await Fetch.json(url);
    if (!res.ok)
        return res;
    const utxos = (Array.isArray(filter))
        ? res.data.filter(e => filter.includes(e.value))
        : res.data;
    return Resolve.data(utxos);
}
export async function esplora_publish_tx(esplora_url, txhex) {
    const url = `${esplora_url}/tx`;
    const opt = { body: txhex, method: 'POST' };
    return Fetch.text(url, opt);
}
