import { None, Some } from '../monads.js';
export const U64_MAX_BIGINT = 0xffffffffffffffffn;
export function u64(num) {
    if (typeof num === 'bigint') {
        if (num < 0n || num > U64_MAX_BIGINT) {
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
(function (u64) {
    u64.MAX = u64(U64_MAX_BIGINT);
    function checkedAdd(x, y) {
        const result = x + y;
        if (result > u64.MAX) {
            return None;
        }
        return Some(u64(result));
    }
    u64.checkedAdd = checkedAdd;
    function checkedSub(x, y) {
        const result = x - y;
        if (result < 0n) {
            return None;
        }
        return Some(u64(result));
    }
    u64.checkedSub = checkedSub;
})(u64 || (u64 = {}));
