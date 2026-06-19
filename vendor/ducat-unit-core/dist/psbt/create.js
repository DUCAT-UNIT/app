import { Transaction } from '@scure/btc-signer';
import { Buff } from '@vbyte/buff';
import { UNSPENDABLE_KEY } from '../const.js';
import { create_taproot, encode_tapscript } from '@vbyte/btc-dev/taproot';
const DEFAULT_CONFIG = () => ({
    index: 0,
    version: 0xc0,
    internalKey: Buff.hex(UNSPENDABLE_KEY)
});
export function create_psbt(opts) {
    return new Transaction(opts);
}
export function create_psbt_output(txoutput) {
    return {
        amount: BigInt(txoutput.value),
        script: Buff.bytes(txoutput.script_pk)
    };
}
export function create_psbt_input(txinput) {
    const pvin = {
        txid: Buff.bytes(txinput.txid),
        index: txinput.vout,
        sequence: txinput.sequence ?? 0xFFFFFFFF,
        witnessUtxo: {
            amount: BigInt(txinput.value),
            script: Buff.bytes(txinput.script_pk)
        }
    };
    if (Array.isArray(txinput.witness) && txinput.witness.length > 0) {
        pvin.finalScriptWitness = txinput.witness.map(w => Buff.bytes(w));
    }
    if (txinput.tapInternalKey !== undefined) {
        pvin.tapInternalKey = txinput.tapInternalKey;
    }
    if (txinput.tapMerkleRoot !== undefined) {
        pvin.tapMerkleRoot = txinput.tapMerkleRoot;
    }
    if (txinput.tapLeafScript !== undefined) {
        pvin.tapLeafScript = txinput.tapLeafScript;
    }
    return pvin;
}
export function create_psbt_tapscript_entry(scripts, options = {}) {
    const config = { ...DEFAULT_CONFIG(), ...options };
    const { index, internalKey } = config;
    const leaf_version = config.version;
    const leaves = scripts.map(e => encode_tapscript(e, leaf_version));
    const target = leaves[index];
    const tap_ctx = create_taproot({ target, leaves, pubkey: internalKey });
    const cblock_version = leaf_version | tap_ctx.parity;
    const redeem_script = Buff.join([scripts[index], Buff.num(leaf_version, 1)]);
    const merkle_path = tap_ctx.path.map(e => new Buff(e));
    return [{ version: cblock_version, internalKey, merklePath: merkle_path }, redeem_script];
}
export function create_psbt_hashlock_entry(thold_hash, thold_key) {
    const hash = Buff.bytes(thold_hash);
    const pimg = Buff.bytes(thold_key);
    return [hash, pimg];
}
export function create_psbt_tapscript_input(scripts, txinput, options = {}) {
    const config = { ...DEFAULT_CONFIG(), ...options };
    return {
        ...create_psbt_input(txinput),
        tapLeafScript: [create_psbt_tapscript_entry(scripts, config)],
        tapInternalKey: config.internalKey
    };
}
