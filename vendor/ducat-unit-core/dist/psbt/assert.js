import { Assert } from '@vbyte/util';
import { get_psbt_vin, get_psbt_vout } from './getter.js';
export function assert_psbt_output(psbt_output) {
    Assert.exists(psbt_output);
    Assert.exists(psbt_output.amount);
    Assert.exists(psbt_output.script);
}
export function assert_psbt_input(psbt_input) {
    Assert.exists(psbt_input);
    Assert.exists(psbt_input.txid);
    Assert.exists(psbt_input.index);
    Assert.exists(psbt_input.witnessUtxo);
}
export function assert_has_prevout(pvin, idx) {
    Assert.exists(pvin.witnessUtxo, `no witness utxo found for PSBT input: ${idx}`);
}
export function assert_has_prevouts(vins) {
    vins.forEach((vin, idx) => {
        assert_has_prevout(vin, idx);
    });
}
export function assert_is_funded(pdata) {
    const prevouts = get_psbt_vin(pdata);
    const outputs = get_psbt_vout(pdata);
    assert_has_prevouts(prevouts);
    const vin_amt = prevouts.reduce((p, n) => p + Number(n.witnessUtxo.amount), 0);
    const out_amt = outputs.reduce((p, n) => p + Number(n.amount), 0);
    Assert.ok(vin_amt >= out_amt, `transaction under-funded: ${vin_amt} sats < ${out_amt} sats`);
}
