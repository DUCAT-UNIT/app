import { Flaw as FlawEnum } from '../flaw.js';
import { u128, u32, u64, u8 } from '../integer/index.js';
export function getFlawString(flaw) {
    switch (flaw) {
        case FlawEnum.EDICT_OUTPUT:
            return 'edict_output';
        case FlawEnum.EDICT_RUNE_ID:
            return 'edict_rune_id';
        case FlawEnum.INVALID_SCRIPT:
            return 'invalid_script';
        case FlawEnum.OPCODE:
            return 'opcode';
        case FlawEnum.SUPPLY_OVERFLOW:
            return 'supply_overflow';
        case FlawEnum.TRAILING_INTEGERS:
            return 'trailing_integers';
        case FlawEnum.TRUNCATED_FIELD:
            return 'truncated_field';
        case FlawEnum.UNRECOGNIZED_EVEN_TAG:
            return 'unrecognized_even_tag';
        case FlawEnum.UNRECOGNIZED_FLAG:
            return 'unrecognized_flag';
        case FlawEnum.VARINT:
            return 'varint';
    }
}
export function u8Strict(n) {
    const bigN = BigInt(n);
    if (bigN < 0n || bigN > u8.MAX) {
        throw Error('u8 overflow');
    }
    return u8(bigN);
}
export function u32Strict(n) {
    const bigN = BigInt(n);
    if (bigN < 0n || bigN > u32.MAX) {
        throw Error('u32 overflow');
    }
    return u32(bigN);
}
export function u64Strict(n) {
    const bigN = BigInt(n);
    if (bigN < 0n || bigN > u64.MAX) {
        throw Error('u64 overflow');
    }
    return u64(bigN);
}
export function u128Strict(n) {
    const bigN = BigInt(n);
    if (bigN < 0n || bigN > u128.MAX) {
        throw Error('u128 overflow');
    }
    return u128(bigN);
}
