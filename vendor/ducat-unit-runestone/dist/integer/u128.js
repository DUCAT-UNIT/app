import { Buff } from '@vbyte/buff';
import { None, Some } from '../monads.js';
import { SeekBuffer } from '../seekbuffer.js';
import { u64 } from './u64.js';
import { u32 } from './u32.js';
import { u8 } from './u8.js';
export const U128_MAX_BIGINT = 0xffffffffffffffffffffffffffffffffn;
export function u128(num) {
    if (typeof num === 'bigint') {
        if (num < 0n || num > U128_MAX_BIGINT) {
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
(function (u128) {
    u128.MAX = u128(U128_MAX_BIGINT);
    function checkedAdd(x, y) {
        const result = x + y;
        if (result > u128.MAX) {
            return None;
        }
        return Some(u128(result));
    }
    u128.checkedAdd = checkedAdd;
    function checkedAddThrow(x, y) {
        const option = u128.checkedAdd(x, y);
        if (option.isNone()) {
            throw new Error('checked add overflow');
        }
        return option.unwrap();
    }
    u128.checkedAddThrow = checkedAddThrow;
    function checkedSub(x, y) {
        const result = x - y;
        if (result < 0n) {
            return None;
        }
        return Some(u128(result));
    }
    u128.checkedSub = checkedSub;
    function checkedSubThrow(x, y) {
        const option = u128.checkedSub(x, y);
        if (option.isNone()) {
            throw new Error('checked sub overflow');
        }
        return option.unwrap();
    }
    u128.checkedSubThrow = checkedSubThrow;
    function checkedMultiply(x, y) {
        const result = x * y;
        if (result > u128.MAX) {
            return None;
        }
        return Some(u128(result));
    }
    u128.checkedMultiply = checkedMultiply;
    function saturatingAdd(x, y) {
        const result = x + y;
        return result > u128.MAX ? u128.MAX : u128(result);
    }
    u128.saturatingAdd = saturatingAdd;
    function saturatingMultiply(x, y) {
        const result = x * y;
        return result > u128.MAX ? u128.MAX : u128(result);
    }
    u128.saturatingMultiply = saturatingMultiply;
    function saturatingSub(x, y) {
        return u128(x < y ? 0 : x - y);
    }
    u128.saturatingSub = saturatingSub;
    function decodeVarInt(seekBuffer) {
        try {
            return Some(tryDecodeVarInt(seekBuffer));
        }
        catch (_e) {
            return None;
        }
    }
    u128.decodeVarInt = decodeVarInt;
    function tryDecodeVarInt(seekBuffer) {
        let result = u128(0);
        for (let i = 0; i <= 18; i++) {
            const byte = seekBuffer.readUInt8();
            if (byte === undefined) {
                throw new Error('Unterminated');
            }
            const value = u128(byte) & 127n;
            if (i === 18 && (value & 124n) !== 0n) {
                throw new Error('Overflow');
            }
            result = u128(result | (value << u128(7 * i)));
            if ((byte & 0b1000_0000) === 0) {
                return result;
            }
        }
        throw new Error('Overlong');
    }
    u128.tryDecodeVarInt = tryDecodeVarInt;
    function encodeVarInt(value) {
        const v = [];
        while (value >> 7n > 0n) {
            v.push(Number(value & 0xffn) | 0b1000_0000);
            value = u128(value >> 7n);
        }
        v.push(Number(value & 0xffn));
        return Buff.from(v);
    }
    u128.encodeVarInt = encodeVarInt;
    function tryIntoU64(n) {
        return n > u64.MAX ? None : Some(u64(n));
    }
    u128.tryIntoU64 = tryIntoU64;
    function tryIntoU32(n) {
        return n > u32.MAX ? None : Some(u32(n));
    }
    u128.tryIntoU32 = tryIntoU32;
    function tryIntoU8(n) {
        return n > u8.MAX ? None : Some(u8(n));
    }
    u128.tryIntoU8 = tryIntoU8;
})(u128 || (u128 = {}));
export function* getAllU128(buffer) {
    const seekBuffer = new SeekBuffer(buffer);
    while (!seekBuffer.isFinished()) {
        const nextValue = u128.tryDecodeVarInt(seekBuffer);
        if (nextValue === undefined) {
            return;
        }
        yield nextValue;
    }
}
