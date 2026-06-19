import { Assert } from '@vbyte/util';
import { get_lock_script_type } from '@vbyte/btc-dev/script';
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
            finalize_legacy_input(pdata, i);
        }
        else if (type === 'p2wpkh') {
            finalize_p2wpkh_input(pdata, i);
        }
        else if (type === 'p2tr') {
            if (pvin.tapLeafScript !== undefined)
                continue;
            finalize_p2tr_input(pdata, i);
        }
    }
}
export function finalize_legacy_input(pdata, index) {
    const pvin = pdata.getInput(index);
    Assert.exists(pvin.witnessUtxo, 'input has no witness UTXO');
    const script = pvin.redeemScript;
    const psig = pvin.partialSig?.at(0);
    if (script !== undefined && psig !== undefined) {
        pdata.finalizeIdx(index);
    }
}
export function finalize_p2wpkh_input(pdata, index) {
    const pvin = pdata.getInput(index);
    Assert.exists(pvin.witnessUtxo, 'input has no witness UTXO');
    Assert.is_empty(pvin.witnessScript, 'input has witness script');
    if (pvin.partialSig?.at(0) !== undefined) {
        pdata.finalizeIdx(index);
    }
}
export function finalize_p2tr_input(pdata, index) {
    const pvin = pdata.getInput(index);
    Assert.exists(pvin.witnessUtxo, 'input has no witness UTXO');
    Assert.is_empty(pvin.tapLeafScript, 'input has tap leaf script');
    if (pvin.tapKeySig?.at(0) !== undefined) {
        pdata.finalizeIdx(index);
    }
}
