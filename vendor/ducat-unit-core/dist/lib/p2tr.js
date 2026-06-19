import { Buff } from '@vbyte/buff';
import { encode_taptweak } from '@vbyte/btc-dev/taproot';
import { get_pubkey, tweak_pubkey, tweak_seckey } from '@vbyte/crypto/ecc';
import { Assert } from '@vbyte/util/assert';
import { assert_bip340_pubkey } from '../validate/assert.js';
export function derive_taproot_output_key(pubkey) {
    assert_bip340_pubkey(pubkey);
    const tweak = encode_taptweak(pubkey);
    return tweak_pubkey(pubkey, tweak, 'bip340', true).hex;
}
export function derive_p2tr_script(pubkey) {
    return `5120${derive_taproot_output_key(pubkey)}`;
}
export function derive_keypath_spend_signer(seckey) {
    const secret = new Buff(seckey).hex;
    const internal_pubkey = get_pubkey(secret, 'bip340').hex;
    const tweak = encode_taptweak(internal_pubkey);
    const tweaked_seckey = tweak_seckey(secret, tweak, true).hex;
    return {
        internal_pubkey,
        output_pubkey: get_pubkey(tweaked_seckey, 'bip340').hex,
        seckey: tweaked_seckey
    };
}
export function assert_keypath_script(script, pubkey) {
    const actual = script instanceof Uint8Array ? new Buff(script).hex : script;
    const expected = derive_p2tr_script(pubkey);
    Assert.ok(actual === expected, `invalid single-key p2tr script: expected ${expected}, got ${actual}`);
}
