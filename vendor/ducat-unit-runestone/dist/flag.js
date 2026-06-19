import { u128 } from './integer/index.js';
export var Flag;
(function (Flag) {
    Flag[Flag["ETCHING"] = 0] = "ETCHING";
    Flag[Flag["TERMS"] = 1] = "TERMS";
    Flag[Flag["TURBO"] = 2] = "TURBO";
    Flag[Flag["CENOTAPH"] = 127] = "CENOTAPH";
})(Flag || (Flag = {}));
(function (Flag) {
    function mask(flag) {
        return u128(1n << BigInt(flag));
    }
    Flag.mask = mask;
    function take(flags, flag) {
        const mask = Flag.mask(flag);
        const set = (flags & mask) !== 0n;
        return { set, flags: set ? u128(flags - mask) : flags };
    }
    Flag.take = take;
    function set(flags, flag) {
        return u128(flags | Flag.mask(flag));
    }
    Flag.set = set;
})(Flag || (Flag = {}));
