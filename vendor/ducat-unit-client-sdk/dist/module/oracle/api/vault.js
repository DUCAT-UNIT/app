import { parse_vault_prevout } from '../lib/vault.js';
import { fetch_record_content, fetch_record_id } from './ordx.js';
import { ord_fetch_inscription, ord_fetch_outpoint, ord_fetch_tx } from './ord.js';
import { parse_outpoint_sat, parse_outpoint_utxo } from '../lib/ord.js';
import { Assert, OrdUtil, Resolve, sleep } from '../../../util/index.js';
import CONST from '../../../const.js';
import Schema from '../../../schema/index.js';
const DEFAULT_IVAL = CONST.FETCH_IVAL;
export async function fetch_vault_token(ord_url, outpoint, ival = DEFAULT_IVAL) {
    OrdUtil.assert_outpoint(outpoint);
    const res1 = await ord_fetch_outpoint(ord_url, outpoint);
    if (!res1.ok)
        return res1;
    const ptr = parse_outpoint_sat(res1.data);
    Assert.exists(ptr, 'sat pointer is null');
    await sleep(ival);
    const res2 = await fetch_record_id(ord_url, ptr);
    if (!res2.ok)
        return res2;
    const tkn_id = res2.data;
    await sleep(ival);
    const schema = Schema.vault.base.token_data;
    const res3 = await fetch_record_content(ord_url, tkn_id, schema);
    if (!res3.ok)
        return res3;
    const revision = res3.data.rev;
    let vid = tkn_id.slice(0, -1) + 1;
    if (revision > 0) {
        await sleep(ival);
        const idx = (-1 * revision) - 1;
        const res = await fetch_record_id(ord_url, ptr, idx);
        if (!res.ok)
            return res;
        vid = res.data.slice(0, -1) + 1;
    }
    const data = res3.data;
    const utxo = parse_outpoint_utxo(outpoint, res1.data);
    return Resolve.data({ data, ptr, utxo, vid });
}
export async function fetch_vault_prevout(ord_url, txid) {
    const res = await ord_fetch_tx(ord_url, txid);
    if (!res.ok)
        return res;
    const prevout = parse_vault_prevout(res.data);
    return Resolve.data(prevout);
}
export async function fetch_vault_profile(ord_url, token, interval = DEFAULT_IVAL) {
    const res1 = await ord_fetch_inscription(ord_url, token.vid);
    if (!res1.ok)
        return res1;
    const satpoint = OrdUtil.parse_satpoint(res1.data.satpoint);
    const acct_id = res1.data.parents.at(0);
    Assert.exists(acct_id, 'vault record not linked to an account');
    await sleep(interval);
    const schema = Schema.oracle.vault.record;
    const res2 = await fetch_record_content(ord_url, token.vid, schema);
    if (!res2.ok)
        return res2;
    const { gpk, mid, vpk } = res2.data;
    await sleep(interval);
    const res3 = await fetch_vault_prevout(ord_url, satpoint[0]);
    if (!res3.ok)
        return res3;
    return Resolve.data({
        ...res3.data,
        acct_id,
        guard_pk: gpk,
        master_id: mid,
        vault_pk: vpk
    });
}
