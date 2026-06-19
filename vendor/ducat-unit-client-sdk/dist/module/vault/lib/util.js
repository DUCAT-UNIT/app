import { Buff } from '@vbyte/buff';
import { parse_address } from '@vbyte/btc-dev/address';
import { encode_script } from '@vbyte/btc-dev/script';
import { UNSPENDABLE_KEY } from '@ducat-unit/core/const';
import { create_taproot, encode_tapscript } from '@vbyte/btc-dev/taproot';
export function get_address_script(address) {
    if (typeof address !== 'string' || address.trim() === '') {
        throw new Error('invalid address: address must be a non-empty string');
    }
    try {
        const parsed = parse_address(address);
        return Buff.hex(parsed.script.hex);
    }
    catch (err) {
        throw new Error(`invalid address: ${address}`, { cause: err });
    }
}
export function create_taproot_script_key(scripts) {
    const leaves = scripts.map(s => encode_tapscript(s));
    const ctx = create_taproot({ leaves, pubkey: UNSPENDABLE_KEY });
    return encode_script(['OP_1', ctx.tapkey]);
}
