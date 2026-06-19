import { Buff } from '@vbyte/buff';
import { Assert } from '@vbyte/util';
import { hash160 } from '@vbyte/crypto/hash';
import { verify_bip340, verify_ecdsa } from '@vbyte/crypto/ecc';
import { get_lock_script_type } from '@vbyte/btc-dev/script';
export function verify_signed_utxo(prevout_script, sighash, witness) {
    const script_type = get_lock_script_type(prevout_script);
    if (script_type === 'p2tr') {
        Assert.ok(witness.length === 1, `verify_signed_utxo: p2tr keypath witness must be [signature]; ` +
            `got ${witness.length} elements (script-path is not supported)`);
        const signature = strip_sighash_byte(witness[0]);
        const output_key = extract_p2tr_output_key(prevout_script);
        Assert.ok(verify_bip340(signature, sighash, output_key), 'verify_signed_utxo: BIP-340 signature verification failed');
        return;
    }
    if (script_type === 'p2wpkh') {
        Assert.ok(witness.length === 2, `verify_signed_utxo: p2wpkh witness must be [signature, pubkey]; ` +
            `got ${witness.length} elements`);
        const signature = strip_sighash_byte(witness[0]);
        const pubkey = witness[1];
        const pk_hash_in_script = extract_p2wpkh_pkh(prevout_script);
        const pk_hash_computed = hash160(pubkey).hex;
        Assert.ok(pk_hash_computed === pk_hash_in_script, `verify_signed_utxo: witness pubkey hash (${pk_hash_computed}) ` +
            `does not match script (${pk_hash_in_script})`);
        Assert.ok(verify_ecdsa(signature, sighash, pubkey), 'verify_signed_utxo: ECDSA signature verification failed');
        return;
    }
    throw new Error(`verify_signed_utxo: unsupported lock script type: ${script_type}`);
}
function strip_sighash_byte(signature_hex) {
    const sig_bytes = Buff.hex(signature_hex);
    if (sig_bytes.length === 65)
        return sig_bytes.slice(0, 64).hex;
    if (sig_bytes.length >= 9 && sig_bytes[0] === 0x30) {
        return sig_bytes.slice(0, sig_bytes.length - 1).hex;
    }
    return signature_hex;
}
function extract_p2tr_output_key(script_hex) {
    const script = Buff.hex(script_hex);
    Assert.ok(script.length === 34 && script[0] === 0x51 && script[1] === 0x20, `verify_signed_utxo: malformed P2TR scriptPubKey: ${script_hex}`);
    return script.slice(2).hex;
}
function extract_p2wpkh_pkh(script_hex) {
    const script = Buff.hex(script_hex);
    Assert.ok(script.length === 22 && script[0] === 0x00 && script[1] === 0x14, `verify_signed_utxo: malformed P2WPKH scriptPubKey: ${script_hex}`);
    return script.slice(2).hex;
}
