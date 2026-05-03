import { Buff } from '@cmdcode/buff';
import { parse_addr } from '@scrow/tapscript/address';
import { encode_script } from '@scrow/tapscript/script';
import { parse_txid } from '@scrow/tapscript/tx';
import { Assert } from '../util/validate.js';
import { TaprootControlBlock, Transaction } from '@scure/btc-signer';
import { encode_tapscript, tap_pubkey } from '@scrow/tapscript/tapkey';
import CONST from '../const.js';
import TX from '../util/tx.js';
export function assert_is_funded(psbt) {
    const pdata = parse_psbt(psbt);
    const pvouts = extract_txins(pdata);
    const txouts = extract_txouts(pdata);
    const vin_amt = pvouts.reduce((p, n) => p + Number(n.amount), 0);
    const out_amt = txouts.reduce((p, n) => p + Number(n.amount), 0);
    Assert.ok(vin_amt >= out_amt, `value in (${vin_amt}) < value out (${out_amt})`);
}
export function extract_vins(psbt) {
    const pdata = parse_psbt(psbt);
    const count = pdata.inputsLength;
    const vins = [];
    for (let i = 0; i < count; i++) {
        const vin = pdata.getInput(i);
        vins.push(vin);
    }
    return vins;
}
export function extract_vouts(psbt) {
    const pdata = parse_psbt(psbt);
    const count = pdata.outputsLength;
    const vouts = [];
    for (let i = 0; i < count; i++) {
        const vout = pdata.getOutput(i);
        vouts.push(vout);
    }
    return vouts;
}
export function extract_txins(psbt) {
    const pdata = parse_psbt(psbt);
    const count = pdata.inputsLength;
    const prevouts = [];
    for (let i = 0; i < count; i++) {
        const { witnessUtxo } = pdata.getInput(i);
        if (witnessUtxo === undefined)
            continue;
        prevouts.push(witnessUtxo);
    }
    return prevouts;
}
export function extract_txouts(psbt) {
    const pdata = parse_psbt(psbt);
    const count = pdata.outputsLength;
    const txouts = [];
    for (let i = 0; i < count; i++) {
        const { amount, script } = pdata.getOutput(i);
        if (amount === undefined || script === undefined)
            continue;
        txouts.push({ amount, script });
    }
    return txouts;
}
export function decode_psbt(b64str) {
    const psbt = Buff.base64(b64str);
    return Transaction.fromPSBT(psbt, { allowUnknownOutputs: true });
}
export function encode_psbt(psbt) {
    const psbt_bytes = psbt.toPSBT(0);
    return new Buff(psbt_bytes).base64;
}
export function parse_psbt(psbt) {
    if (psbt instanceof Transaction) {
        return psbt;
    }
    else if (typeof psbt === 'string') {
        return decode_psbt(psbt);
    }
    else {
        throw new Error('invalid psbt: ' + psbt);
    }
}
export function extract_tx(psbt) {
    let pdata = parse_psbt(psbt);
    pdata = finalize_legacy_inputs(pdata);
    const txdata = pdata.extract();
    return new Buff(txdata).hex;
}
export function get_txhex(psbt) {
    let pdata = parse_psbt(psbt);
    pdata = finalize_legacy_inputs(pdata);
    return pdata.hex;
}
export function get_vin_total(psbt) {
    const vins = extract_vins(psbt);
    return vins.reduce((acc, vin) => acc + Number(vin.witnessUtxo?.amount ?? 0), 0);
}
export function extract_prevouts(psbt) {
    const scripts = [], values = [];
    const pdata = parse_psbt(psbt);
    for (let i = 0; i < pdata.inputsLength; i++) {
        const txin = pdata.getInput(i);
        Assert.exists(txin.witnessUtxo, `witness utxo does not exist for input ${i}`);
        scripts.push(txin.witnessUtxo.script);
        values.push(txin.witnessUtxo.amount);
    }
    return { scripts, values };
}
export function extract_key_witness(psbt, index) {
    const pdata = parse_psbt(psbt);
    const txin = pdata.getInput(index);
    if (txin.finalScriptWitness !== undefined) {
        return txin.finalScriptWitness.map(e => new Buff(e).hex);
    }
    else if (txin.partialSig?.at(0) !== undefined) {
        return txin.partialSig[0].map(e => new Buff(e).hex);
    }
    else if (txin.tapKeySig !== undefined) {
        return [new Buff(txin.tapKeySig).hex];
    }
    else {
        throw new Error('key signature not found');
    }
}
export function extract_script_witness(psbt, index) {
    const pdata = parse_psbt(psbt);
    const txin = pdata.getInput(index);
    if (txin.finalScriptWitness !== undefined) {
        return txin.finalScriptWitness.map(e => new Buff(e).hex);
    }
    else {
        const tleaf = txin.tapLeafScript?.at(0);
        Assert.ok(tleaf !== undefined, 'tapLeaf entry not found');
        const tss = txin.tapScriptSig?.at(0);
        Assert.ok(tss !== undefined, 'tapScriptSig entry not found');
        const cblock = TaprootControlBlock.encode(tleaf[0]);
        const script = new Buff(tleaf[1].slice(0, -1)).hex;
        const sig = new Buff(tss[1]).hex;
        return [sig, script, new Buff(cblock).hex];
    }
}
export function extract_hash_witness(psbt, index) {
    const pdata = parse_psbt(psbt);
    const txin = pdata.getInput(index);
    if (txin.finalScriptWitness !== undefined) {
        return txin.finalScriptWitness.map(e => new Buff(e).hex);
    }
    else {
        const tleaf = txin.tapLeafScript?.at(0);
        Assert.ok(tleaf !== undefined, 'tapLeaf entry not found');
        const tss = txin.hash160?.at(0);
        Assert.ok(tss !== undefined, 'hash160 entry not found');
        const cblock = TaprootControlBlock.encode(tleaf[0]);
        const script = new Buff(tleaf[1].slice(0, -1)).hex;
        const pimg = new Buff(tss[1]).hex;
        return [pimg, script, new Buff(cblock).hex];
    }
}
export function extract_utxo(psbt, index) {
    let pdata = parse_psbt(psbt);
    pdata = finalize_legacy_inputs(pdata);
    const txout = pdata.getOutput(index);
    const txdata = pdata.hex;
    assert_psbt_output(txout);
    return {
        txid: parse_txid(txdata, false),
        vout: index,
        value: Number(txout.amount),
        script: new Buff(txout.script).hex
    };
}
export function extract_vin(psbt, index) {
    const pdata = parse_psbt(psbt);
    const txinput = pdata.getInput(index);
    assert_psbt_input(txinput);
    return {
        txid: new Buff(txinput.txid).hex,
        vout: txinput.index,
        value: Number(txinput.witnessUtxo.amount),
        script: new Buff(txinput.witnessUtxo.script).hex
    };
}
export function extract_sighash(psbt, index) {
    const pdata = parse_psbt(psbt);
    const prevouts = extract_prevouts(pdata);
    const script = prevouts.scripts.at(index);
    const amount = prevouts.values.at(index);
    const txinput = pdata.getInput(index);
    assert_psbt_input(txinput);
    Assert.exists(script, 'prevout script not found for index: ' + index);
    Assert.exists(amount, 'prevout amount not found for index: ' + index);
    const vintype = TX.parse_script_meta(script).type;
    if (vintype === 'p2w-pkh') {
        const pk_hash = new Buff(script.slice(2)).hex;
        const sigscript = Buff.hex(`76a914${pk_hash}88ac`);
        return new Buff(pdata.preimageWitnessV0(index, sigscript, 1, amount)).hex;
    }
    else if (vintype === 'p2sh') {
        Assert.ok(txinput.finalScriptSig?.at(1) === 20, 'invalid scriptsig for wrapped segwit');
        const pk_hash = new Buff(txinput.finalScriptSig.slice(2)).hex;
        const sigscript = Buff.hex(`76a914${pk_hash}88ac`);
        return new Buff(pdata.preimageWitnessV0(index, sigscript, 1, amount)).hex;
    }
    else if (vintype === 'p2tr') {
        return new Buff(pdata.preimageWitnessV1(index, prevouts.scripts, 0, prevouts.values)).hex;
    }
    else {
        throw new Error('invalid input type: ' + vintype);
    }
}
export function extract_signed_vin(psbt, index) {
    const pdata = parse_psbt(psbt);
    const utxo = extract_vin(pdata, index);
    const sighash = extract_sighash(pdata, index);
    const witness = extract_key_witness(pdata, index);
    return { ...utxo, sighash, witness };
}
export function extract_scripted_vin(psbt, index) {
    const pdata = parse_psbt(psbt);
    const utxo = extract_vin(pdata, index);
    const witness = extract_script_witness(pdata, index);
    return { ...utxo, witness };
}
export function extract_hlock_vin(psbt, index) {
    const pdata = parse_psbt(psbt);
    const utxo = extract_vin(pdata, index);
    const witness = extract_hash_witness(pdata, index);
    return { ...utxo, witness };
}
export function extract_finalized_vin(psbt, index) {
    const pdata = parse_psbt(psbt);
    const txinput = pdata.getInput(index);
    const utxo = extract_vin(pdata, index);
    Assert.exists(txinput.finalScriptWitness, `PSBT input ${index} does not have a finalized witness`);
    const witness = txinput.finalScriptWitness.map(e => new Buff(e).hex);
    return { ...utxo, witness };
}
export function finalize_script_vin(psbt, index) {
    const pdata = parse_psbt(psbt);
    const pvin = pdata.getInput(index);
    const tdata = pvin.tapLeafScript?.at(0);
    const sdata = pvin.tapScriptSig?.at(0);
    Assert.exists(tdata, 'tapLeaf data is missing');
    Assert.exists(sdata, 'tapScriptSig data is missing');
    const script = tdata[1].slice(0, -1);
    const cblock = TaprootControlBlock.encode(tdata[0]);
    pdata.updateInput(index, {
        finalScriptWitness: [sdata[1], script, cblock]
    });
    return encode_psbt(pdata);
}
export function extract_funding_vins(psbt, opt = {}) {
    const pdata = parse_psbt(psbt);
    const exclude = opt.post_exclude;
    const filter = opt.post_filter;
    const start = opt.start_idx ?? 1;
    const stop = opt.stop_idx ?? pdata.inputsLength;
    const utxos = [];
    for (let i = start; i < stop; i++) {
        const utxo = extract_signed_vin(pdata, i);
        if (typeof exclude === 'number' && utxo.value === exclude) {
            continue;
        }
        else if (typeof filter === 'number' && utxo.value !== filter) {
            continue;
        }
        else {
            utxos.push(utxo);
        }
    }
    return utxos;
}
export function create_psbt_hashlock(hash, pimg) {
    return [Buff.hex(hash), Buff.hex(pimg)];
}
export function create_psbt_tapscript(scripts, index = 0, version = 0xc0) {
    const taptree = scripts.map(e => encode_tapscript(e, version));
    const tapleaf = taptree[index];
    const taproot_ctx = tap_pubkey(CONST.UNSPENDABLE_KEY, { taptree, tapleaf });
    const parity = version | taproot_ctx.parity;
    const redeemScript = Buff.join([encode_script(scripts[index], false), Buff.num(version, 1)]);
    const internalKey = Buff.hex(CONST.UNSPENDABLE_KEY);
    const merklePath = taproot_ctx.path.map(e => new Buff(e));
    return [{ version: parity, internalKey, merklePath }, redeemScript];
}
export function create_psbt_output(output) {
    return {
        amount: BigInt(output.value),
        script: Buff.hex(output.script)
    };
}
export function create_psbt_input(utxo, witness) {
    const txinput = {
        txid: new Buff(utxo.txid),
        index: utxo.vout,
        witnessUtxo: {
            amount: BigInt(utxo.value),
            script: Buff.hex(utxo.script)
        }
    };
    if (Array.isArray(witness)) {
        txinput.finalScriptWitness = witness;
    }
    return txinput;
}
export function create_psbt_payout(amount, address) {
    return {
        amount: BigInt(amount),
        script: new Buff(parse_addr(address).hex)
    };
}
export function get_vsize(psbt) {
    const pdata = parse_psbt(psbt);
    return pdata.vsize;
}
export function assert_psbt_output(psbt_out) {
    Assert.exists(psbt_out);
    Assert.exists(psbt_out.amount);
    Assert.exists(psbt_out.script);
}
export function assert_psbt_input(psbt_vin) {
    Assert.exists(psbt_vin);
    Assert.exists(psbt_vin.txid);
    Assert.exists(psbt_vin.index);
    Assert.exists(psbt_vin.witnessUtxo);
}
export default {
    assert: {
        has_vin: assert_psbt_input,
        has_vout: assert_psbt_output,
        is_funded: assert_is_funded
    },
    extract: {
        tx: extract_tx,
        utxo: extract_utxo,
        base_vin: extract_vin,
        signed_vin: extract_signed_vin,
        hlock_vin: extract_hlock_vin,
        script_vin: extract_scripted_vin,
        sighash: extract_sighash,
        final_vin: extract_finalized_vin,
        funding_vins: extract_funding_vins,
        prevouts: extract_prevouts,
        key_witness: extract_key_witness,
        script_witness: extract_script_witness
    },
    get: {
        txhex: get_txhex,
        vsize: get_vsize,
        vin_total: get_vin_total
    },
    util: {
        finalize_legacy_inputs,
    },
    create: {
        psbt: (opts) => new Transaction(opts),
        input: create_psbt_input,
        hashlock: create_psbt_hashlock,
        output: create_psbt_output,
        payout: create_psbt_payout,
        tapscript: create_psbt_tapscript
    },
    finalize: {
        script_vin: finalize_script_vin
    },
    encode: encode_psbt,
    decode: decode_psbt,
    parse: parse_psbt
};
function finalize_legacy_inputs(pdata) {
    for (let i = 0; i < pdata.inputsLength; i++) {
        const pvin = pdata.getInput(i);
        const script = pvin.redeemScript;
        const psig = pvin.partialSig?.at(0);
        if (script !== undefined && psig !== undefined) {
            pdata.finalizeIdx(i);
        }
    }
    return pdata;
}
