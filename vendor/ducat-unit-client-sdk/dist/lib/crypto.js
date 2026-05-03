import { Buff } from '@cmdcode/buff';
import { secp256k1, schnorr } from '@noble/curves/secp256k1';
import { mod } from '@noble/curves/abstract/modular';
import Schema from '../schema/index.js';
import { Check } from '../util/index.js';
export function gen_seckey(secret) {
    let sbig = (secret !== undefined)
        ? Buff.hex(secret).big
        : Buff.random(32).big;
    sbig = mod(sbig, secp256k1.CURVE.n);
    return Buff.big(sbig).hex;
}
export function get_pubkey(seckey) {
    const pbytes = schnorr.getPublicKey(seckey);
    return new Buff(pbytes).hex;
}
export function sign_ecdsa(seckey, message) {
    const sig = secp256k1.sign(message, seckey);
    return new Buff(sig.toDERRawBytes()).hex;
}
export function verify_ecdsa_pubkey(pubkey) {
    try {
        const cpub = Schema.base.cpubkey.parse(pubkey);
        secp256k1.Point.fromHex(cpub);
    }
    catch {
        throw new Error('invalid ecdsa pubkey: ' + pubkey);
    }
}
export function verify_ecdsa_sig(message, pubkey, signature) {
    if (!Check.is_hex(signature)) {
        throw new Error('invalid signature encoding: ' + signature);
    }
    else if (signature.length > 146) {
        throw new Error('invalid signature length: ' + signature.length);
    }
    const sig = signature.slice(0, -2);
    if (!secp256k1.verify(sig, message, pubkey, { format: 'der' })) {
        throw new Error(`invalid ecdsa signature:\n\tmessage: ${message}\n\tpubkey: ${pubkey}\n\tsignature: ${sig}`);
    }
}
export function sign_bip340(seckey, message) {
    const sig = schnorr.sign(message, seckey);
    return new Buff(sig).hex;
}
export function verify_bip340_pubkey(pubkey) {
    try {
        const pub = Schema.base.xpubkey.parse(pubkey);
        secp256k1.ProjectivePoint.fromHex('02' + pub);
    }
    catch {
        throw new Error('invalid bip340 pubkey: ' + pubkey);
    }
}
export function verify_bip340_sig(message, pubkey, signature) {
    if (!Check.is_hex(signature)) {
        throw new Error('invalid signature encoding: ' + signature);
    }
    else if (signature.length > 130) {
        throw new Error('invalid signature length: ' + signature.length);
    }
    const sig = signature.slice(0, 128);
    if (!schnorr.verify(sig, message, pubkey)) {
        throw new Error(`invalid bip340 signature:\n\tmessage: ${message}\n\tpubkey: ${pubkey}\n\tsignature: ${sig}`);
    }
}
