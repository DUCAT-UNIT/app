import { Assert } from '@vbyte/util';
import { parse_psbt } from './parse.js';
import { decode_sequence } from '../lib/sequence.js';
export function get_psbt_vin(psbt) {
    const pdata = parse_psbt(psbt);
    const count = pdata.inputsLength;
    const vins = [];
    for (let i = 0; i < count; i++) {
        const vin = pdata.getInput(i);
        vins.push(vin);
    }
    return vins;
}
export function get_psbt_vin_total(psbt) {
    const pdata = parse_psbt(psbt);
    const count = pdata.inputsLength;
    let total = BigInt(0);
    for (let i = 0; i < count; i++) {
        const vin = pdata.getInput(i);
        if (vin.witnessUtxo) {
            total += vin.witnessUtxo.amount;
        }
    }
    return total;
}
export function get_psbt_vout(psbt) {
    const pdata = parse_psbt(psbt);
    const count = pdata.outputsLength;
    const vouts = [];
    for (let i = 0; i < count; i++) {
        const vout = pdata.getOutput(i);
        vouts.push(vout);
    }
    return vouts;
}
export function get_psbt_prevouts(psbt) {
    const pdata = parse_psbt(psbt);
    const count = pdata.inputsLength;
    const amounts = [];
    const scripts = [];
    for (let i = 0; i < count; i++) {
        const vin = pdata.getInput(i);
        Assert.exists(vin.witnessUtxo, `no witness utxo found for PSBT input: ${i}`);
        amounts.push(vin.witnessUtxo.amount);
        scripts.push(vin.witnessUtxo.script);
    }
    return { amounts, scripts };
}
export function get_psbt_input(psbt, index) {
    const pdata = parse_psbt(psbt);
    return pdata.getInput(index);
}
export function get_psbt_output(psbt, index) {
    const pdata = parse_psbt(psbt);
    return pdata.getOutput(index);
}
export function get_psbt_input_sequence(psbt, index) {
    const pdata = parse_psbt(psbt);
    const pvin = pdata.getInput(index);
    return (typeof pvin.sequence === 'number')
        ? decode_sequence(pvin.sequence)
        : null;
}
export function get_psbt_input_code(input) {
    if (!input.sequence)
        return null;
    const sdata = decode_sequence(input.sequence);
    if (sdata.type !== 'metadata')
        return null;
    return sdata.code;
}
