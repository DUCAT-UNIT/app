"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.u8 = exports.U8_MAX_BIGINT = void 0;
const monads_1 = require("../monads");
exports.U8_MAX_BIGINT = 0xffn;
function u8(num) {
    if (typeof num == 'bigint') {
        if (num < 0n || num > exports.U8_MAX_BIGINT) {
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
exports.u8 = u8;
(function (u8) {
    u8.MAX = u8(exports.U8_MAX_BIGINT);
    function checkedAdd(x, y) {
        const result = x + y;
        if (result > u8.MAX) {
            return monads_1.None;
        }
        return (0, monads_1.Some)(u8(result));
    }
    u8.checkedAdd = checkedAdd;
    function checkedSub(x, y) {
        const result = x - y;
        if (result < 0n) {
            return monads_1.None;
        }
        return (0, monads_1.Some)(u8(result));
    }
    u8.checkedSub = checkedSub;
})(u8 || (exports.u8 = u8 = {}));
//# sourceMappingURL=u8.js.map