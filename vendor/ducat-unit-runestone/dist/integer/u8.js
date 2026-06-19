import { None, Some } from '../monads.js';
export const U8_MAX_BIGINT = 0xffn;
export function u8(num) {
    if (typeof num === 'bigint') {
        if (num < 0n || num > U8_MAX_BIGINT) {
            throw new Error('num is out of range');
        }
    }
    else {
        if (!Number.isSafeInteger(num) || num < 0) {
            throw new Error('num is not a valid integer');
        }
    }
    return BigInt(num);
}
(function (u8) {
    u8.MAX = u8(U8_MAX_BIGINT);
    function checkedAdd(x, y) {
        const result = x + y;
        if (result > u8.MAX) {
            return None;
        }
        return Some(u8(result));
    }
    u8.checkedAdd = checkedAdd;
    function checkedSub(x, y) {
        const result = x - y;
        if (result < 0n) {
            return None;
        }
        return Some(u8(result));
    }
    u8.checkedSub = checkedSub;
})(u8 || (u8 = {}));
