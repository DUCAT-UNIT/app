import { tap_pubkey } from '@scrow/tapscript/tapkey';
export function taptweak_pubkey(pubkey) {
    const ctx = tap_pubkey(pubkey);
    return ctx.tapkey;
}
