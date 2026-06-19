import { Assert } from '@vbyte/util';
import { Buff } from '@vbyte/buff';
import { get_lock_script_type } from '@vbyte/btc-dev/script';
import { PSBT } from '@ducat-unit/core';
import { decode_sequence } from '@ducat-unit/core/lib';
import { BIGINT, DUST_LIMIT, COSIGN_CODES, LIQUID_CODES } from '../../../const.js';
export function get_input_code(input) {
    if (!input.sequence)
        return null;
    const sdata = decode_sequence(input.sequence);
    if (sdata.type !== 'metadata')
        return null;
    return sdata.code;
}
export function calc_psbt_totals(pdata) {
    let txin_total = BIGINT._0;
    let vout_total = BIGINT._0;
    for (let idx = 0; idx < pdata.outputsLength; idx++) {
        const vout = pdata.getOutput(idx);
        Assert.exists(vout.amount, `amount not set for vout index: ${idx}`);
        Assert.exists(vout.script, `script key does not exist for vout index: ${idx}`);
        Assert.ok(vout.amount >= BigInt(DUST_LIMIT), `amount is below the dust limit: ${vout.amount} < ${DUST_LIMIT}`);
        vout_total += vout.amount;
    }
    for (let idx = 0; idx < pdata.inputsLength; idx++) {
        const txin = pdata.getInput(idx);
        Assert.ok(txin.nonWitnessUtxo === undefined, `legacy UTXO is not supported`);
        const amount = txin.witnessUtxo?.amount;
        Assert.exists(amount, `prevout does not exist for txin index: ${idx}`);
        Assert.exists(txin.witnessUtxo?.amount, `amount not set for txin index: ${idx}`);
        txin_total += amount;
    }
    const fees_total = txin_total - vout_total;
    return { txin_total, vout_total, fees_total };
}
export function finalize_spending_inputs(pdata) {
    for (let i = 0; i < pdata.inputsLength; i++) {
        const pvin = pdata.getInput(i);
        if (!pvin.witnessUtxo)
            continue;
        const script = pvin.witnessUtxo.script;
        const type = get_lock_script_type(script);
        if (type === null)
            continue;
        if (type === 'p2sh') {
            PSBT.finalize_legacy_input(pdata, i);
        }
        else if (type === 'p2wpkh') {
            PSBT.finalize_p2wpkh_input(pdata, i);
        }
        else if (type === 'p2tr') {
            if (pvin.tapLeafScript !== undefined)
                continue;
            PSBT.finalize_p2tr_input(pdata, i);
        }
    }
}
export function finalize_cosign_inputs(pdata) {
    for (let idx = 0; idx < pdata.inputsLength; idx++) {
        const pvin = pdata.getInput(idx);
        const code = get_input_code(pvin);
        if (code === null)
            continue;
        if (!COSIGN_CODES.includes(code))
            continue;
        Assert.ok(pvin.tapLeafScript !== undefined && pvin.tapLeafScript.length > 0, 'tapLeafScript array is empty or missing');
        Assert.ok(pvin.tapScriptSig !== undefined && pvin.tapScriptSig.length > 0, 'tapScriptSig array is empty or missing');
        const tap_data = pvin.tapLeafScript[0];
        const sig_data = pvin.tapScriptSig[0];
        Assert.ok(tap_data[1] !== undefined && tap_data[1].length > 0, 'tapLeaf script data is empty');
        const script = tap_data[1].slice(0, -1);
        const cblock = PSBT.encode_psbt_cblock(tap_data[0]);
        pdata.updateInput(idx, {
            finalScriptWitness: [sig_data[1], script, cblock]
        });
    }
}
export function finalize_liquid_inputs(pdata) {
    for (let idx = 0; idx < pdata.inputsLength; idx++) {
        const pvin = pdata.getInput(idx);
        const code = get_input_code(pvin);
        if (code === null)
            continue;
        if (!LIQUID_CODES.includes(code))
            continue;
        Assert.ok(pvin.tapLeafScript !== undefined && pvin.tapLeafScript.length > 0, 'tapLeafScript array is empty or missing');
        Assert.ok(pvin.hash160 !== undefined && pvin.hash160.length > 0, 'hash160 array is empty or missing');
        const tap_data = pvin.tapLeafScript[0];
        const hash_data = pvin.hash160[0];
        Assert.ok(tap_data[1] !== undefined && tap_data[1].length > 0, 'tapLeaf script data is empty');
        const script = tap_data[1].slice(0, -1);
        const cblock = PSBT.encode_psbt_cblock(tap_data[0]);
        pdata.updateInput(idx, {
            finalScriptWitness: [hash_data[1], script, cblock]
        });
    }
}
export function extract_guardian_sighashes(pdata) {
    const prevouts = PSBT.get_psbt_prevouts(pdata);
    const sighashes = [];
    for (let idx = 0; idx < pdata.inputsLength; idx++) {
        const pvin = pdata.getInput(idx);
        const code = get_input_code(pvin);
        if (code === null)
            continue;
        if (!COSIGN_CODES.includes(code) && !LIQUID_CODES.includes(code))
            continue;
        Assert.ok(pvin.tapLeafScript !== undefined && pvin.tapLeafScript.length > 0, 'tapLeafScript array is empty or missing');
        const tap_data = pvin.tapLeafScript[0];
        Assert.ok(tap_data[1] !== undefined && tap_data[1].length > 0, 'tapLeaf script data is empty');
        const script = tap_data[1].slice(0, -1);
        const sighash = pdata.preimageWitnessV1(idx, prevouts.scripts, 0, prevouts.amounts, undefined, script);
        sighashes.push({
            idx,
            sighash: new Buff(sighash).hex,
            sigflag: 0
        });
    }
    return sighashes;
}
