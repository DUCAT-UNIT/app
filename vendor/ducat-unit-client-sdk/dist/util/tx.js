import { Buff } from '@cmdcode/buff';
import { Script } from '@scure/btc-signer';
import { Assert } from '../util/index.js';
import { create_addr, P2TR, parse_addr } from '@scrow/tapscript/address';
import { encode_tapscript, tap_pubkey } from '@scrow/tapscript/tapkey';
import { decode_script, encode_script, parse_script } from '@scrow/tapscript/script';
import { create_vin, parse_tx, parse_txid, parse_txsize, encode_tx as scrow_encode_tx, decode_tx as scrow_decode_tx } from '@scrow/tapscript/tx';
import CONST from '../const.js';
export function create_address(script, network = 'regtest') {
    return create_addr(script, network);
}
export function create_sats_txin(utxo) {
    const { txid, vout, value, script } = utxo;
    return create_vin({ txid, vout, prevout: { value, scriptPubKey: script } });
}
export function create_ord_txin(utxo) {
    const { txid, vout, value: postage, script } = utxo;
    return create_vin({ txid, vout, prevout: { value: postage, scriptPubKey: script } });
}
export function get_block_seq_val(timer) {
    const BLOCK_TIME = CONST.BLOCK_DURATION;
    const time_delay = Math.max(timer, BLOCK_TIME);
    return Math.ceil(time_delay / BLOCK_TIME);
}
export function extract_utxo(tx, vout) {
    const txdata = parse_tx(tx);
    const txid = parse_txid(txdata);
    const prevout = txdata.vout.at(vout);
    Assert.exists(prevout, 'tx output does not exist');
    const { value, scriptPubKey } = prevout;
    const script = encode_script(scriptPubKey, false).hex;
    return { script, txid, vout, value: Number(value) };
}
export function extract_op_return(tx) {
    const txdata = parse_tx(tx);
    const txout = txdata.vout.at(-1);
    Assert.exists(txout, 'tx output does not exist');
    Assert.ok(txout.value === CONST.BIGINT._0, 'tx data output is not zero value');
    const script = parse_script(txout.scriptPubKey);
    Assert.ok(script.asm[0] === 'OP_RETURN', 'output script does not start with OP_RETURN');
    return script.hex;
}
export function get_txid(txdata) {
    return parse_txid(txdata);
}
export function get_txsize(txdata) {
    return parse_txsize(txdata);
}
export function get_vin_vsize(utxos) {
    let vsize = 0;
    for (const utxo of utxos) {
        const ctx = parse_script_meta(utxo.script);
        vsize += get_txin_type_vsize(ctx.type);
    }
    return vsize;
}
export function get_txin_type_vsize(type) {
    switch (type) {
        case 'p2sh':
            return CONST.TXSIZE.TXIN.P2SH;
        case 'p2w-pkh':
            return CONST.TXSIZE.TXIN.P2WK;
        case 'p2tr':
            return CONST.TXSIZE.TXIN.P2TR;
        default:
            throw new Error('unsupported input type: ' + type);
    }
}
export function get_taproot_script_key(scripts, index = 0, version = 0xc0) {
    const taptree = scripts.map(e => encode_tapscript(e, version));
    const tapleaf = taptree[index];
    const taproot_ctx = tap_pubkey(CONST.UNSPENDABLE_KEY, { taptree, tapleaf });
    return taproot_ctx.tapkey;
}
export function create_tr_address(pubkey, network) {
    return P2TR.encode(pubkey, network);
}
export function encode_p2tr_pubkey(pubkey) {
    return Script.encode(['OP_1', Buff.hex(pubkey)]);
}
export function encode_tx(txdata) {
    return scrow_encode_tx(txdata).hex;
}
export function decode_tx(txhex) {
    return scrow_decode_tx(txhex);
}
export function parse_address(address) {
    return parse_addr(address);
}
export function parse_address_script(address) {
    return Buff.hex(parse_addr(address).hex);
}
export function parse_script_meta(script) {
    return parse_script(script);
}
export function parse_script_asm(script) {
    return parse_script(script).asm;
}
export default {
    create_address,
    create_tr_address,
    create_ord_txin,
    create_sats_txin,
    extract_utxo,
    extract_op_return,
    get_block_seq_val,
    get_taproot_script_key,
    get_txid,
    get_txsize,
    get_txin_type_vsize,
    get_vin_vsize,
    encode_script: (script, varint = false) => encode_script(script, varint),
    decode_script,
    encode_p2tr_pubkey,
    encode_tx,
    decode_tx,
    parse_address,
    parse_address_script,
    parse_script_asm,
    parse_script_meta
};
