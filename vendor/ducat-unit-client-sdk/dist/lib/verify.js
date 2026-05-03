import { Assert, TX } from '../util/index.js';
import { verify_bip340_pubkey, verify_bip340_sig, verify_ecdsa_pubkey, verify_ecdsa_sig } from './crypto.js';
import Schema from '../schema/index.js';
export function verify_account_profile(profile) {
    const schema = Schema.oracle.mint.acct_profile;
    const result = schema.safeParse(profile);
    if (!result.success) {
        console.error(result.error);
        throw new Error('account profile failed schema validation');
    }
}
export function verify_price_quote(quote) {
    const schema = Schema.oracle.quote.price_quote;
    const result = schema.safeParse(quote);
    if (!result.success) {
        console.error(result.error);
        throw new Error('price quote failed schema validation');
    }
}
export function verify_proto_contract(contract) {
    const schema = Schema.oracle.proto.proto_profile;
    const result = schema.safeParse(contract);
    if (!result.success) {
        console.error(result.error);
        throw new Error('proto contract failed schema validation');
    }
}
export function verify_vault_profile(profile) {
    const schema = Schema.oracle.vault.profile;
    const result = schema.safeParse(profile);
    if (!result.success) {
        console.error(result.error);
        throw new Error('vault profile failed schema validation');
    }
}
export function verify_signed_utxo(utxo) {
    Assert.exists(utxo.sighash, 'sighash is missing');
    const { type, key } = TX.parse_script_meta(utxo.script);
    let pubkey, signature = utxo.witness.at(0);
    Assert.exists(signature, 'signature is missing');
    if (type === 'p2sh' || type === 'p2w-pkh') {
        pubkey = utxo.witness.at(1);
        Assert.exists(pubkey, 'pubkey is missing');
        verify_ecdsa_pubkey(pubkey);
        verify_ecdsa_sig(utxo.sighash, pubkey, signature);
    }
    else if (type === 'p2tr') {
        pubkey = key.hex;
        verify_bip340_pubkey(pubkey);
        verify_bip340_sig(utxo.sighash, pubkey, signature);
    }
    else {
        throw new Error('unsupported funding input type: ' + type);
    }
}
