import { fetch_record_id } from './ordx.js';
import { fetch_account_record } from './record.js';
import { Assert, OrdUtil, Resolve, sleep } from '../../../util/index.js';
import { parse_inscription_utxo, parse_outpoint_sat, parse_rune_data } from '../lib/ord.js';
import { ord_fetch_inscription, ord_fetch_outpoint, ord_fetch_rune } from './ord.js';
import CONST from '../../../const.js';
export async function fetch_account_profile(mint, ord_url, outpoint, ival = CONST.FETCH_IVAL) {
    OrdUtil.assert_outpoint(outpoint);
    const res1 = await ord_fetch_outpoint(ord_url, outpoint);
    if (!res1.ok)
        return res1;
    const runes = parse_rune_data(res1.data);
    const rdata = runes.get(mint.label);
    Assert.exists(rdata, 'rune data returned null');
    const sat = parse_outpoint_sat(res1.data);
    Assert.exists(sat, 'sat pointer returned null');
    await sleep(ival);
    const res2 = await fetch_record_id(ord_url, sat);
    if (!res2.ok)
        return res2;
    const acct_id = res2.data;
    await sleep(ival);
    const res3 = await ord_fetch_inscription(ord_url, acct_id);
    if (!res3.ok)
        return res3;
    const parents = res3.data.parents;
    Assert.ok(parents.includes(mint.mint_id), 'account is not related to mint');
    await sleep(ival);
    const res4 = await fetch_account_record(ord_url, acct_id);
    if (!res4.ok)
        return res4;
    return Resolve.data({
        acct_id,
        balance: rdata.amount,
        issued: res4.data.iss,
        utxo: parse_inscription_utxo(res3.data)
    });
}
export async function fetch_mint_profile(ord_url, pointer, ival = CONST.FETCH_IVAL) {
    const [address, identifier] = pointer;
    OrdUtil.assert_inscribe_id(identifier);
    const res1 = await ord_fetch_inscription(ord_url, identifier);
    if (!res1.ok) {
        return res1;
    }
    else if (res1.data.rune === null) {
        return Resolve.fail('inscription not linked to a rune');
    }
    else if (res1.data.address !== address) {
        return Resolve.fail('record points to an unrecognized address', 403);
    }
    await sleep(ival);
    const res2 = await ord_fetch_rune(ord_url, res1.data.rune);
    if (!res2.ok)
        return res2;
    return Resolve.data({
        address: res1.data.address,
        burned: res2.data.entry.burned,
        divisor: res2.data.entry.divisibility,
        issued: res2.data.entry.premine,
        label: res1.data.rune,
        mint_id: identifier,
        rune_id: res2.data.id,
        symbol: res2.data.entry.symbol,
        utxo: parse_inscription_utxo(res1.data)
    });
}
