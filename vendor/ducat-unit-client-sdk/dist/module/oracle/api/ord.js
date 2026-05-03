import { Assert, Fetch, OrdUtil, Resolve } from '../../../util/index.js';
export async function ord_fetch_tx(ord_url, txid) {
    Assert.is_hash(txid);
    const url = `${ord_url}/tx/${txid}`;
    const opt = { headers: { Accept: 'application/json' } };
    return Fetch.json(url, opt);
}
export async function ord_fetch_inscription(ord_url, identifier) {
    OrdUtil.assert_inscribe_id(identifier);
    const url = `${ord_url}/inscription/${identifier}`;
    const opt = { headers: { Accept: 'application/json' } };
    return Fetch.json(url, opt);
}
export async function ord_fetch_content(ord_url, identifier) {
    OrdUtil.assert_inscribe_id(identifier);
    const url = `${ord_url}/content/${identifier}`;
    const opt = { headers: { Accept: 'application/json' } };
    return Fetch.json(url, opt);
}
export async function ord_fetch_outpoint(ord_url, outpoint) {
    OrdUtil.assert_outpoint(outpoint);
    const url = `${ord_url}/output/${outpoint}`;
    const opt = { headers: { Accept: 'application/json' } };
    return Fetch.json(url, opt);
}
export async function ord_fetch_sat(ord_url, sat_id) {
    const url = `${ord_url}/sat/${sat_id}`;
    const opt = { headers: { Accept: 'application/json' } };
    return Fetch.json(url, opt);
}
export async function ord_fetch_rune(ord_url, rune_name) {
    const url = `${ord_url}/rune/${rune_name}`;
    const opt = { headers: { Accept: 'application/json' } };
    return Fetch.json(url, opt);
}
export async function ord_fetch_address(ord_url, address) {
    const url = `${ord_url}/address/${address}`;
    const opt = { headers: { Accept: 'application/json' } };
    return Fetch.json(url, opt);
}
export async function ord_fetch_children(ord_url, identifier) {
    OrdUtil.assert_inscribe_id(identifier);
    const url = `${ord_url}/r/children/${identifier}/inscriptions`;
    const opt = { headers: { Accept: 'application/json' } };
    return Fetch.json(url, opt);
}
export async function ord_fetch_sat_identifier(ord_url, sat_ptr, index = 0) {
    const url = `${ord_url}/r/sat/${sat_ptr}/at/${index}`;
    const opt = { headers: { Accept: 'application/json' } };
    const res = await Fetch.json(url, opt);
    if (!res.ok)
        return res;
    return Resolve.data(res.data.id);
}
