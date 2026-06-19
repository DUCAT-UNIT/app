import { Buff, Stream } from '@vbyte/buff';
import { Assert } from '@vbyte/util';
import { INSCRIPTION_MAGIC } from '../const.js';
import { decode_script, encode_script } from '@vbyte/btc-dev/script';
const _0N = BigInt(0);
const _1N = BigInt(1);
const _26N = BigInt(26);
const ENVELOPE_MAGIC_WORD = INSCRIPTION_MAGIC.slice(2);
export function has_inscription(script) {
    let words;
    try {
        words = decode_script(script);
    }
    catch {
        return false;
    }
    for (let i = 0; i + 2 < words.length; i++) {
        if (words[i] === 'OP_0' &&
            words[i + 1] === 'OP_IF' &&
            words[i + 2] === ENVELOPE_MAGIC_WORD) {
            return true;
        }
    }
    return false;
}
export function decode_inscriptions(script) {
    const envelopes = parse_envelopes(script);
    return envelopes.map(parse_inscription);
}
export function encode_inscriptions(data) {
    return data.map(create_envelope).join('');
}
const TAG_CONTENT_TYPE = 0x01;
const TAG_POINTER = 0x02;
const TAG_PARENT = 0x03;
const TAG_METAPROTOCOL = 0x07;
const TAG_DELEGATE = 0x0b;
const TAG_RUNE = 0x0d;
const OP_PUSHDATA1 = 0x4c;
const OP_PUSHDATA2 = 0x4d;
const MAX_SCRIPT_ELEMENT_SIZE = 520;
function encode_data_push(bytes) {
    const len = bytes.length;
    if (len <= 75) {
        return Buff.join([Buff.num(len, 1), bytes]);
    }
    if (len <= 255) {
        return Buff.join([Buff.num(OP_PUSHDATA1, 1), Buff.num(len, 1), bytes]);
    }
    if (len <= MAX_SCRIPT_ELEMENT_SIZE) {
        return Buff.join([Buff.num(OP_PUSHDATA2, 1), Buff.num(len, 2, 'le'), bytes]);
    }
    throw new Error(`inscription tag value exceeds ${MAX_SCRIPT_ELEMENT_SIZE}-byte push limit: ${len} bytes`);
}
function encode_tag_field(tag, value) {
    const tag_part = Buff.join([Buff.num(1, 1), Buff.num(tag, 1)]);
    const value_bytes = Buff.is_hex(value) ? Buff.hex(value) : Buff.str(value);
    const value_part = encode_data_push(value_bytes);
    return Buff.join([tag_part, value_part]).hex;
}
function create_envelope(data) {
    const prefix = encode_script(['OP_0', 'OP_IF', '6f7264']).hex;
    let body_hex = '';
    if (typeof data.mimetype === 'string') {
        const label = encode_label(data.mimetype);
        body_hex += encode_tag_field(TAG_CONTENT_TYPE, label);
    }
    if (typeof data.pointer === 'number') {
        const ptr = encode_pointer(data.pointer);
        body_hex += encode_tag_field(TAG_POINTER, ptr);
    }
    if (typeof data.parent === 'string') {
        const id = encode_id(data.parent);
        body_hex += encode_tag_field(TAG_PARENT, id);
    }
    if (typeof data.protocol === 'string') {
        body_hex += encode_tag_field(TAG_METAPROTOCOL, data.protocol);
    }
    if (typeof data.delegate === 'string') {
        const id = encode_id(data.delegate);
        body_hex += encode_tag_field(TAG_DELEGATE, id);
    }
    if (typeof data.rune === 'string') {
        const label = encode_rune_label(data.rune);
        body_hex += encode_tag_field(TAG_RUNE, label);
    }
    if (typeof data.content === 'string') {
        const chunks = encode_content(data.content);
        body_hex += encode_script(['OP_0', ...chunks]).hex;
    }
    const suffix = encode_script(['OP_ENDIF']).hex;
    return prefix + body_hex + suffix;
}
function parse_envelopes(script) {
    const words = decode_script(script);
    const data_idx = words.indexOf('OP_0');
    Assert.ok(data_idx !== -1, 'inscription envelope not found');
    const envelopes = [];
    for (let idx = data_idx; idx < words.length; idx++) {
        Assert.ok(words[idx + 1] === 'OP_IF', 'OP_IF missing from envelope');
        Assert.ok(words[idx + 2] === '6f7264', 'magic bytes missing from envelope');
        const stop_idx = words.indexOf('OP_ENDIF');
        Assert.ok(stop_idx !== -1, 'inscription envelope missing END_IF statement');
        const envelope = words.slice(idx + 3, stop_idx);
        envelopes.push(envelope);
        idx += stop_idx;
    }
    return envelopes;
}
function normalize_tag(word) {
    switch (word) {
        case 'OP_1': return TAG_CONTENT_TYPE;
        case 'OP_2': return TAG_POINTER;
        case 'OP_3': return TAG_PARENT;
        case 'OP_7': return TAG_METAPROTOCOL;
        case 'OP_11': return TAG_DELEGATE;
        case 'OP_13': return TAG_RUNE;
    }
    if (/^[0-9a-f]{2}$/.test(word)) {
        return parseInt(word, 16);
    }
    return null;
}
function parse_inscription(envelope) {
    const record = {};
    for (let i = 0; i < envelope.length; i++) {
        if (envelope[i] === 'OP_0') {
            record.content = decode_content(envelope.slice(i + 1));
            return record;
        }
        const tag = normalize_tag(envelope[i]);
        switch (tag) {
            case TAG_CONTENT_TYPE:
                record.mimetype = decode_label(envelope[i + 1]);
                i += 1;
                break;
            case TAG_POINTER:
                record.pointer = decode_pointer(envelope[i + 1]);
                i += 1;
                break;
            case TAG_PARENT:
                record.parent = decode_id(envelope[i + 1]);
                i += 1;
                break;
            case TAG_METAPROTOCOL:
                record.protocol = envelope[i + 1];
                i += 1;
                break;
            case TAG_DELEGATE:
                record.delegate = decode_id(envelope[i + 1]);
                i += 1;
                break;
            case TAG_RUNE:
                record.rune = decode_rune_label(envelope[i + 1]);
                i += 1;
                break;
        }
    }
    return record;
}
function encode_id(identifier) {
    Assert.ok(identifier.includes('i'), 'identifier must include an index');
    const parts = identifier.split('i');
    const bytes = Buff.hex(parts[0]);
    const idx = Number(parts[1]);
    const txid = bytes.reverse().hex;
    return (idx !== 0) ? txid + Buff.num(idx).hex : txid;
}
function decode_id(hexstr) {
    const bytes = Buff.hex(hexstr);
    const idx = bytes.at(-1) ?? 0;
    const txid = bytes.slice(0, -1).reverse().hex;
    return `${txid}i${String(idx)}`;
}
function encode_pointer(pointer) {
    return Buff.num(pointer).reverse().hex;
}
const POINTER_OPCODES = (() => {
    const m = new Map([['OP_0', 0]]);
    for (let n = 1; n <= 16; n++) {
        m.set(`OP_${n}`, n);
        m.set(`OP_PUSHNUM_${n}`, n);
    }
    return m;
})();
function decode_pointer(word) {
    if (word.startsWith('OP_')) {
        const num = POINTER_OPCODES.get(word);
        if (num === undefined)
            throw new Error(`Invalid pointer opcode: ${word}`);
        return num;
    }
    return Buff.hex(word).reverse().num;
}
function encode_label(label) {
    return Buff.str(label).hex;
}
function decode_label(hexstr) {
    return Buff.hex(hexstr).str;
}
function encode_content(content) {
    const stream = Buff.is_hex(content)
        ? new Stream(Buff.hex(content))
        : new Stream(Buff.str(content));
    const chunks = [];
    while (stream.size > 0) {
        if (stream.size > 520) {
            const chunk = stream.read(520);
            chunks.push(chunk.hex);
        }
        else {
            const chunk = stream.read(stream.size);
            chunks.push(chunk.hex);
        }
    }
    return chunks;
}
function decode_content(hexstrs, type = 'hex') {
    const data = Buff.join(hexstrs);
    return (type === 'hex')
        ? data.hex
        : data.str;
}
function encode_rune_label(label) {
    const str = label.toUpperCase();
    let big = _0N;
    for (const char of str) {
        if (char >= 'A' && char <= 'Z') {
            big = big * _26N + BigInt(char.charCodeAt(0) - ('A'.charCodeAt(0) - 1));
        }
        else { }
    }
    big = big - _1N;
    return Buff.big(big).reverse().hex;
}
function decode_rune_label(hex) {
    let big = Buff.hex(hex).reverse().big;
    big = big + _1N;
    let result = '';
    while (big > _0N) {
        const mod = big % _26N;
        if (mod === _0N) {
            result = `Z${result}`;
            big = big / _26N - _1N;
        }
        else {
            const char_code = Number(mod) + 'A'.charCodeAt(0) - 1;
            result = String.fromCharCode(char_code) + result;
            big = big / _26N;
        }
    }
    return result;
}
