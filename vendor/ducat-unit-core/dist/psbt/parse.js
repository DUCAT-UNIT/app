import { Transaction } from '@scure/btc-signer';
import { Buff } from '@vbyte/buff';
import { Test } from '@vbyte/util';
import { Base64 } from '@vbyte/crypto/encode';
export function decode_psbt(encoded_psbt) {
    if (encoded_psbt instanceof Uint8Array) {
        return Transaction.fromPSBT(encoded_psbt, { allowUnknownOutputs: true });
    }
    else if (Test.is_hex(encoded_psbt)) {
        const bytes = Buff.hex(encoded_psbt);
        return Transaction.fromPSBT(bytes, { allowUnknownOutputs: true });
    }
    else if (Test.is_base64(encoded_psbt)) {
        const bytes = Base64.decode(encoded_psbt);
        return Transaction.fromPSBT(bytes, { allowUnknownOutputs: true });
    }
    else {
        throw new Error(`invalid psbt string: ${encoded_psbt}`);
    }
}
export function encode_psbt(psbt, version = 0) {
    const bytes = psbt.toPSBT(version);
    return Base64.encode(bytes);
}
export function parse_psbt(psbt) {
    if (psbt instanceof Transaction) {
        return psbt;
    }
    else if (psbt instanceof Uint8Array || typeof psbt === 'string') {
        return decode_psbt(psbt);
    }
    else {
        throw new Error(`invalid psbt input: ${psbt}`);
    }
}
