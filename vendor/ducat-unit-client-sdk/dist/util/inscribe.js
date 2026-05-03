import { Buff } from '@cmdcode/buff';
import { parse_script } from '@scrow/tapscript/script';
import { Assert } from './validate.js';
export var InscribeUtil;
(function (InscribeUtil) {
    function parse(script) {
        const words = parse_script(script).asm;
        const start_idx = words.findIndex(e => e === 'OP_0');
        Assert.ok(start_idx !== -1, 'inscription zero index not found');
        const envelopes = [];
        for (let idx = start_idx; idx < words.length; idx++) {
            Assert.ok(words[idx] === 'OP_0', 'OP_0 missing from envelope');
            Assert.ok(words[idx + 1] === 'OP_IF', 'OP_IF missing from envelope');
            Assert.ok(words[idx + 2] === '6f7264', 'magic missing from envelope');
            const stop_idx = words.findIndex(e => e === 'OP_ENDIF');
            Assert.ok(stop_idx !== -1, 'inscription envelope missing END_IF statement');
            const envelope = words.slice(idx + 3, stop_idx);
            envelopes.push(envelope);
            idx += stop_idx;
        }
        return envelopes.map(e => parse_inscription_words(e));
    }
    InscribeUtil.parse = parse;
})(InscribeUtil || (InscribeUtil = {}));
function parse_inscription_words(words) {
    const ret = {};
    for (let i = 0; i < words.length; i++) {
        switch (words[i]) {
            case 'OP_1':
                ret.type = Buff.hex(words[i + 1]).str;
                i += 1;
                break;
            case 'OP_2':
                ret.pointer = parse_inscription_pointer(words[i + 1]);
                i += 1;
                break;
            case 'OP_3':
                ret.parent = parse_inscription_id(words[i + 1]);
                i += 1;
                break;
            case 'OP_11':
                ret.delegate = parse_inscription_id(words[i + 1]);
                i += 1;
                break;
            case 'OP_13':
                ret.rune = words[i + 1];
                i += 1;
                break;
            case 'OP_0':
                ret.body = parse_inscription_body(words.slice(i + 1), ret.type);
                return ret;
            default:
                throw new Error('unknown code: ' + words[i]);
        }
    }
    return ret;
}
function parse_inscription_id(word) {
    const bytes = Buff.hex(word);
    const idx = bytes.at(-1) ?? 0;
    const txid = bytes.slice(0, -1).reverse().hex;
    return txid + 'i' + String(idx);
}
function parse_inscription_pointer(word) {
    return Buff.hex(word).reverse().num;
}
function parse_inscription_body(words, type) {
    const bytes = Buff.join(words);
    switch (type) {
        case 'application/json':
            return bytes.to_json();
        case 'text/plain':
            return bytes.str;
        default:
            return bytes.hex;
    }
}
