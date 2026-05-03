"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.u64 = exports.U64_MAX_BIGINT = void 0;
const monads_1 = require("../monads");
exports.U64_MAX_BIGINT = 0xffffffffffffffffn;
function u64(num) {
    if (typeof num == 'bigint') {
        if (num < 0n || num > exports.U64_MAX_BIGINT) {
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
exports.u64 = u64;
(function (u64) {
    u64.MAX = u64(exports.U64_MAX_BIGINT);
    function checkedAdd(x, y) {
        const result = x + y;
        if (result > u64.MAX) {
            return monads_1.None;
        }
        return (0, monads_1.Some)(u64(result));
    }
    u64.checkedAdd = checkedAdd;
    function checkedSub(x, y) {
        const result = x - y;
        if (result < 0n) {
            return monads_1.None;
        }
        return (0, monads_1.Some)(u64(result));
    }
    u64.checkedSub = checkedSub;
})(u64 || (exports.u64 = u64 = {}));
//# sourceMappingURL=u64.js.map