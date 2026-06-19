import { None, Some } from '../monads.js';
export const U32_MAX_BIGINT = 0xffffffffn;
export function u32(num) {
    if (typeof num === 'bigint') {
        if (num < 0n || num > U32_MAX_BIGINT) {
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
(function (u32) {
    u32.MAX = u32(U32_MAX_BIGINT);
    function checkedAdd(x, y) {
        const result = x + y;
        if (result > u32.MAX) {
            return None;
        }
        return Some(u32(result));
    }
    u32.checkedAdd = checkedAdd;
    function checkedSub(x, y) {
        const result = x - y;
        if (result < 0n) {
            return None;
        }
        return Some(u32(result));
    }
    u32.checkedSub = checkedSub;
})(u32 || (u32 = {}));
