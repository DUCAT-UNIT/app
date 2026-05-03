"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.u32 = exports.U32_MAX_BIGINT = void 0;
const monads_1 = require("../monads");
exports.U32_MAX_BIGINT = 0xffffffffn;
function u32(num) {
    if (typeof num == 'bigint') {
        if (num < 0n || num > exports.U32_MAX_BIGINT) {
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
exports.u32 = u32;
(function (u32) {
    u32.MAX = u32(exports.U32_MAX_BIGINT);
    function checkedAdd(x, y) {
        const result = x + y;
        if (result > u32.MAX) {
            return monads_1.None;
        }
        return (0, monads_1.Some)(u32(result));
    }
    u32.checkedAdd = checkedAdd;
    function checkedSub(x, y) {
        const result = x - y;
        if (result < 0n) {
            return monads_1.None;
        }
        return (0, monads_1.Some)(u32(result));
    }
    u32.checkedSub = checkedSub;
})(u32 || (exports.u32 = u32 = {}));
//# sourceMappingURL=u32.js.map