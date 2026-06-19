import { TaprootControlBlock } from '@scure/btc-signer/psbt.js';
export function encode_psbt_cblock(cblock) {
    return TaprootControlBlock.encode(cblock);
}
export function decode_psbt_cblock(buffer) {
    return TaprootControlBlock.decode(buffer);
}
