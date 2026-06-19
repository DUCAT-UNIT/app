import { Buff } from '@vbyte/buff';
import { P2TR } from '@vbyte/btc-dev/address';
import { get_pubkey } from '@vbyte/crypto/ecc';
import { derive_taproot_output_key } from '../lib/p2tr.js';
import { to_address_network } from '../lib/chain.js';
import { sign_inputs_api } from '../lib/cosigner.js';
import { sign_vault_request_api } from '../lib/handler.js';
const SIGNER_SECKEYS = new WeakMap();
export class GuardianSigner {
    constructor(proto, seckey) {
        this._proto = proto;
        const sk = new Buff(seckey);
        SIGNER_SECKEYS.set(this, sk);
        this._pubkey = get_pubkey(sk, 'bip340');
        const tapkey = Buff.hex(derive_taproot_output_key(this._pubkey.hex));
        this._address = P2TR.create_address(tapkey, to_address_network(this.network));
    }
    get address() {
        return this._address;
    }
    get network() {
        return this._proto.chain_network;
    }
    get proto() {
        return this._proto;
    }
    get pubkey() {
        return this._pubkey.hex;
    }
    get sign() {
        return {
            input: sign_inputs_api(this),
            request: sign_vault_request_api(this)
        };
    }
}
export function read_signer_seckey(signer) {
    const sk = SIGNER_SECKEYS.get(signer);
    if (sk === undefined) {
        throw new Error('guardian signer secret key is not registered');
    }
    return sk.hex;
}
