import { Buff } from '@cmdcode/buff';
import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';
export function hash160(...bytes) {
    const preimage = Buff.join(bytes);
    const hash_256 = sha256(preimage);
    const hash_160 = ripemd160(hash_256);
    return new Buff(hash_160).hex;
}
