import { Buff } from '@vbyte/buff';
import { None, Some } from './monads.js';
import { u128 } from './integer/index.js';
export var Tag;
(function (Tag) {
    Tag[Tag["BODY"] = 0] = "BODY";
    Tag[Tag["FLAGS"] = 2] = "FLAGS";
    Tag[Tag["RUNE"] = 4] = "RUNE";
    Tag[Tag["PREMINE"] = 6] = "PREMINE";
    Tag[Tag["CAP"] = 8] = "CAP";
    Tag[Tag["AMOUNT"] = 10] = "AMOUNT";
    Tag[Tag["HEIGHT_START"] = 12] = "HEIGHT_START";
    Tag[Tag["HEIGHT_END"] = 14] = "HEIGHT_END";
    Tag[Tag["OFFSET_START"] = 16] = "OFFSET_START";
    Tag[Tag["OFFSET_END"] = 18] = "OFFSET_END";
    Tag[Tag["MINT"] = 20] = "MINT";
    Tag[Tag["POINTER"] = 22] = "POINTER";
    Tag[Tag["CENOTAPH"] = 126] = "CENOTAPH";
    Tag[Tag["DIVISIBILITY"] = 1] = "DIVISIBILITY";
    Tag[Tag["SPACERS"] = 3] = "SPACERS";
    Tag[Tag["SYMBOL"] = 5] = "SYMBOL";
    Tag[Tag["NOP"] = 127] = "NOP";
})(Tag || (Tag = {}));
(function (Tag) {
    function take(tag, fields, n, withFn) {
        const field = fields.get(u128(tag));
        if (field === undefined) {
            return None;
        }
        const values = [];
        for (const i of [...Array(n).keys()]) {
            if (field[i] === undefined) {
                return None;
            }
            values[i] = field[i];
        }
        const optionValue = withFn(values);
        if (optionValue.isNone()) {
            return None;
        }
        field.splice(0, n);
        if (field.length === 0) {
            fields.delete(u128(tag));
        }
        return Some(optionValue.unwrap());
    }
    Tag.take = take;
    function encode(tag, values) {
        return Buff.join(values.flatMap((value) => [u128.encodeVarInt(u128(tag)), u128.encodeVarInt(value)]));
    }
    Tag.encode = encode;
    function encodeOptionInt(tag, value) {
        return value.map((value) => Tag.encode(tag, [u128(value)])).unwrapOr(Buff.from([]));
    }
    Tag.encodeOptionInt = encodeOptionInt;
})(Tag || (Tag = {}));
