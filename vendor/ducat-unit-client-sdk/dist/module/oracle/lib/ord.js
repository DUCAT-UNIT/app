import { decode_script } from '@scrow/tapscript/script';
import { parse_address_script } from '../../../util/tx.js';
import { Assert, InscribeUtil, OrdUtil } from '../../../util/index.js';
export function parse_outpoint(outpoint) {
    OrdUtil.assert_outpoint(outpoint);
    const [txid, vout] = outpoint.split(':');
    return { txid, vout: Number(vout) };
}
export function parse_outpoint_sat(output) {
    return output.sat_ranges?.at(0)?.at(0) ?? null;
}
export function parse_output_pointers(res) {
    Assert.exists(res.sat_ranges, 'server returned a null pointer');
    const curr_ptr = res.sat_ranges?.at(0)?.at(0);
    Assert.exists(curr_ptr, 'server returned a null pointer');
    const next_ptr = res.sat_ranges?.at(-1)?.at(-1);
    Assert.exists(next_ptr, 'server returned a null pointer');
    return [curr_ptr, next_ptr];
}
export function parse_outpoint_utxo(outpoint, res) {
    const { script_pubkey: script, value } = res;
    OrdUtil.assert_outpoint(outpoint);
    const out_pt = outpoint.split(':');
    return { txid: out_pt[0], vout: Number(out_pt[1]), value, script };
}
export function parse_inscription_utxo(res) {
    const { address, satpoint, value } = res;
    const sat_pt = satpoint.split(':');
    const script = parse_address_script(address).hex;
    return { txid: sat_pt[0], vout: Number(sat_pt[1]), value, script };
}
export function parse_rune_data(output) {
    const { runes } = output;
    return (runes !== null)
        ? new Map(Object.entries(runes))
        : new Map();
}
export function parse_inscription_ctx(witness) {
    const [sig, script, cblock] = witness;
    const words = decode_script(script, false);
    const pubkey = words.at(0);
    Assert.is_hash(pubkey, 'script defined pubkey is invalid');
    Assert.ok(words.at(1) === 'OP_CHECKSIG', 'OP_CHECKSIG missing from script');
    const inscriptions = InscribeUtil.parse(script);
    return { pubkey, sig, inscriptions, script, cblock };
}
export function parse_html_rune_balances(html) {
    const lines = html.split('\n');
    const start_idx = lines.findIndex(e => e.includes('<dt>runes balances</dt>'));
    const stop_idx = lines.findIndex(e => e.includes('<dt>outputs</dt>'));
    Assert.ok(start_idx !== -1, 'unable to locate start index for rune balances');
    Assert.ok(stop_idx !== -1, 'unable to locate stop index for rune balances');
    const items = lines.slice(start_idx + 1, stop_idx);
    const entries = items.map(e => {
        const parts = e.split('</a>: ');
        const label = parts[0].split('>').at(-1);
        const value = parts[1].split('<').at(0)?.slice(0, -1);
        Assert.exists(label, 'unable to parse rune label');
        Assert.exists(value, 'unable to parse rune amount');
        return [label, Number(value)];
    });
    return new Map(entries);
}
export function parse_html_sat_balance(html) {
    const lines = html.split('\n');
    const index = lines.findIndex(e => e.includes('<dt>sat balance</dt>'));
    Assert.ok(index !== -1, 'unable to locate index for sat balance');
    const line = lines[index + 1];
    const data = line.split('<dd>').at(1)?.split('</dd>').at(0);
    Assert.exists(data, 'unable to parse sat balance');
    const bal = Number(data);
    Assert.is_number(bal);
    return bal;
}
export function parse_html_inscriptions(html) {
    const lines = html.split('\n');
    const start_idx = lines.findIndex(e => e.includes('<dt>inscriptions</dt>'));
    const stop_idx = lines.findIndex(e => e.includes('<dt>runes balances</dt>'));
    Assert.ok(start_idx !== -1, 'unable to locate start index for inscriptions');
    Assert.ok(stop_idx !== -1, 'unable to locate stop index for inscriptions');
    const arr = lines.slice(start_idx + 2, stop_idx - 1);
    const ids = arr.map(e => {
        const id = e.split('/inscription/').at(1)?.split('>').at(0);
        OrdUtil.assert_inscribe_id(id);
        return id;
    });
    return ids;
}
export function parse_html_outpoints(html) {
    const lines = html.split('\n');
    const start_idx = lines.findIndex(e => e.includes('<dt>outputs</dt>'));
    Assert.ok(start_idx !== -1, 'unable to locate start index for outpoints');
    const parts = lines.slice(start_idx + 3);
    const stop_idx = parts.findIndex(e => e.includes('</ul>'));
    Assert.ok(stop_idx !== -1, 'unable to locate stop index for outpoints');
    const arr = parts.slice(0, stop_idx);
    const outs = arr.map(e => {
        const outpoint = e.split('href=/output/').at(1)?.split('>').at(0);
        OrdUtil.assert_outpoint(outpoint);
        return outpoint;
    });
    return outs;
}
