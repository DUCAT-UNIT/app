import { Buff } from '@vbyte/buff';
import { hash160 } from '@vbyte/crypto/hash';
import { P2TR, P2WPKH } from '@vbyte/btc-dev/address';
import { derive_taproot_output_key, to_address_network } from '@ducat-unit/core/lib';
import { ValidationError } from '../../../lib/errors/index.js';
import { serialize_pubkey } from '@vbyte/crypto/ecc';
export function get_wallet_accounts(config, network) {
    const { asset, funds, vault } = config;
    return {
        asset: get_wallet_account(network, asset.pubkey, 1),
        funds: get_wallet_account(network, funds.pubkey, funds.version),
        vault: get_wallet_account(network, vault.pubkey, 1)
    };
}
function get_wallet_account(network, pubkey, version) {
    switch (version) {
        case 0:
            return get_v0_account_data(network, pubkey);
        case 1:
            return get_v1_account_data(network, pubkey);
        default:
            throw new ValidationError(`invalid account version: ${version}`);
    }
}
function get_v0_account_data(network, pubkey) {
    const _pubkey = serialize_pubkey(pubkey, 'ecdsa');
    return {
        address: P2WPKH.create_address(_pubkey, to_address_network(network)),
        keydata: hash160(_pubkey).hex,
        pubkey: _pubkey.hex,
        version: 0
    };
}
function get_v1_account_data(network, pubkey) {
    const _pubkey = serialize_pubkey(pubkey, 'bip340');
    const _tapkey = Buff.hex(derive_taproot_output_key(_pubkey.hex));
    return {
        address: P2TR.create_address(_tapkey, to_address_network(network)),
        keydata: _tapkey.hex,
        pubkey: _pubkey.hex,
        version: 0x51
    };
}
