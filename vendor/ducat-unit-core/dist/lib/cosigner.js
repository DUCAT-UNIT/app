import { Buff } from '@vbyte/buff';
import { Assert } from '@vbyte/util/assert';
import { sign_bip340, verify_bip340 } from '@vbyte/crypto/ecc';
import { TaprootControlBlock } from '@scure/btc-signer';
import * as PSBT from '../psbt/index.js';
import { assert_keypath_script, derive_keypath_spend_signer } from './p2tr.js';
import { parse_cosigner_script } from './script.js';
import { read_signer_seckey } from '../class/cosigner.js';
const SCHNORR_SIG_LENGTH = 64;
function validate_schnorr_signature(sig, context = 'signature', sighash, pubkey) {
    Assert.exists(sig, `${context} is missing`);
    Assert.ok(sig.length === SCHNORR_SIG_LENGTH, `${context} has invalid length: expected ${SCHNORR_SIG_LENGTH} bytes, got ${sig.length} bytes`);
    if (sighash !== undefined && pubkey !== undefined) {
        const is_valid = verify_bip340(sig, sighash, pubkey);
        Assert.ok(is_valid, `${context} failed cryptographic verification against expected pubkey`);
    }
}
export function sign_inputs_api(guardian) {
    return {
        cosign: cosign_vault_input_api(guardian),
        liquidate: sign_liquid_input_api(guardian),
        spend: sign_spend_input_api(guardian)
    };
}
function sign_spend_input_api(guard) {
    return (psbt, index) => {
        const pdata = PSBT.parse_psbt(psbt);
        const vinput = pdata.getInput(index);
        const prevout = vinput.witnessUtxo;
        Assert.exists(prevout, 'witnessUtxo is missing');
        const prevouts = PSBT.get_psbt_prevouts(pdata);
        const sighash = pdata.preimageWitnessV1(index, prevouts.scripts, 0, prevouts.amounts);
        assert_keypath_script(prevout.script, guard.pubkey);
        const signer = derive_keypath_spend_signer(read_signer_seckey(guard));
        const mpc_sig = sign_bip340(signer.seckey, sighash);
        pdata.updateInput(index, { finalScriptWitness: [mpc_sig] });
        return PSBT.encode_psbt(pdata);
    };
}
export function sign_liquid_input_api(guard) {
    return (psbt, index) => {
        const pdata = PSBT.parse_psbt(psbt);
        const vinput = pdata.getInput(index);
        const odata = vinput.witnessUtxo;
        Assert.exists(odata, 'witnessUtxo is missing');
        Assert.ok(vinput.tapLeafScript !== undefined && vinput.tapLeafScript.length > 0, 'tapLeafScript array is empty or missing');
        Assert.ok(vinput.hash160 !== undefined && vinput.hash160.length > 0, 'hash160 array is empty or missing');
        const tdata = vinput.tapLeafScript[0];
        const hdata = vinput.hash160[0];
        Assert.ok(tdata[1] !== undefined && tdata[1].length > 0, 'tapLeaf script data is empty');
        const script = tdata[1].slice(0, -1);
        const prevouts = PSBT.get_psbt_prevouts(pdata);
        const sighash = pdata.preimageWitnessV1(index, prevouts.scripts, 0, prevouts.amounts, undefined, script);
        const mpc_sig = sign_bip340(read_signer_seckey(guard), sighash);
        const cblock = TaprootControlBlock.encode(tdata[0]);
        const witness = [mpc_sig, hdata[1], script, cblock];
        pdata.updateInput(index, { finalScriptWitness: witness });
        return PSBT.encode_psbt(pdata);
    };
}
export function cosign_vault_input_api(guard) {
    return (psbt, index) => {
        const pdata = PSBT.parse_psbt(psbt);
        const vinput = pdata.getInput(index);
        const odata = vinput.witnessUtxo;
        Assert.exists(odata, 'witnessUtxo is missing');
        Assert.ok(vinput.tapLeafScript !== undefined && vinput.tapLeafScript.length > 0, 'tapLeafScript array is empty or missing');
        Assert.ok(vinput.tapScriptSig !== undefined && vinput.tapScriptSig.length > 0, 'tapScriptSig array is empty or missing');
        const tdata = vinput.tapLeafScript[0];
        const sdata = vinput.tapScriptSig[0];
        Assert.ok(tdata[1] !== undefined && tdata[1].length > 0, 'tapLeaf script data is empty');
        const script = tdata[1].slice(0, -1);
        const prevouts = PSBT.get_psbt_prevouts(pdata);
        const sighash = pdata.preimageWitnessV1(index, prevouts.scripts, 0, prevouts.amounts, undefined, script);
        const mpc_sig = sign_bip340(read_signer_seckey(guard), sighash);
        const vault_sig = sdata[1];
        const script_hex = new Buff(script).hex;
        const script_parsed = parse_cosigner_script(script_hex);
        validate_schnorr_signature(vault_sig, 'vault signature', sighash, script_parsed.client_pubkey);
        const cblock = TaprootControlBlock.encode(tdata[0]);
        const witness = [mpc_sig, vault_sig, script, cblock];
        pdata.updateInput(index, { finalScriptWitness: witness });
        return PSBT.encode_psbt(pdata);
    };
}
