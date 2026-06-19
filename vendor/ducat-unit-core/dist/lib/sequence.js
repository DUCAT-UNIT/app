import { Assert } from '@vbyte/util';
const TIMELOCK_DISABLE = 0x80000000;
const TIMELOCK_TYPE = 0x00400000;
const TIMELOCK_VALUE_MASK = 0x0000FFFF;
const TIMELOCK_VALUE_MAX = 0xFFFF;
const TIMELOCK_GRANULARITY = 512;
const METADATA_SIGNAL = 0x40000000;
const METADATA_DISABLE = 0x20000000;
const METADATA_SHORT_MASK = 0xFFFF;
const METADATA_BYTE_MASK = 0xFF;
export function encode_sequence(data) {
    Assert.exists(data.type, 'must specify sequence type');
    switch (data.type) {
        case 'timelock':
            return encode_timelock(data);
        case 'metadata':
            return encode_metadata(data);
        case 'number':
            return encode_number(data);
        case 'null':
            return encode_nullified();
        default:
            throw new Error(`invalid sequence data:${String(data)}`);
    }
}
export function decode_sequence(sequence) {
    const seq = parse_sequence(sequence);
    if ((seq & TIMELOCK_DISABLE) && (seq & METADATA_SIGNAL) && !(seq & METADATA_DISABLE)) {
        return decode_metadata(seq);
    }
    if (!(seq & TIMELOCK_DISABLE)) {
        return decode_timelock(seq);
    }
    if (seq === 0xFFFFFFFF) {
        return { type: 'null' };
    }
    return decode_number(seq);
}
function encode_timelock(data) {
    if (data.format === 'height') {
        const height = parse_height(data.value);
        const sequence = (height & TIMELOCK_VALUE_MASK) >>> 0;
        return parse_sequence(sequence);
    }
    if (data.format === 'stamp') {
        const stamp = parse_stamp(data.value);
        const sequence = (TIMELOCK_TYPE | (stamp & TIMELOCK_VALUE_MASK)) >>> 0;
        return parse_sequence(sequence);
    }
    throw new Error(`invalid timelock format: ${String(data.format)}`);
}
function encode_metadata(data) {
    const base_seq = TIMELOCK_DISABLE | METADATA_SIGNAL;
    const version = parse_byte(data.version) & METADATA_BYTE_MASK;
    const code = (parse_short(data.code) & METADATA_SHORT_MASK) << 8;
    const sequence = (base_seq | version | code) >>> 0;
    return parse_sequence(sequence);
}
function encode_number(data) {
    const sequence = data.value ?? 0xFFFFFFFF;
    return parse_sequence(sequence);
}
function encode_nullified() {
    return parse_sequence(0xFFFFFFFF);
}
function decode_timelock(sequence) {
    const value = sequence & TIMELOCK_VALUE_MASK;
    if (sequence & TIMELOCK_TYPE) {
        const stamp = value * TIMELOCK_GRANULARITY;
        if (stamp > 0xFFFFFFFF) {
            throw new Error('decoded timestamp exceeds 32-bit limit');
        }
        return { type: 'timelock', format: 'stamp', value: stamp };
    }
    else {
        const height = value;
        if (height > TIMELOCK_VALUE_MAX) {
            throw new Error('decoded height exceeds maximum');
        }
        return { type: 'timelock', format: 'height', value: height };
    }
}
function decode_metadata(sequence) {
    const version = sequence & METADATA_BYTE_MASK;
    const code = (sequence >>> 8) & METADATA_SHORT_MASK;
    return { code, type: 'metadata', version };
}
function decode_number(sequence) {
    return { type: 'number', value: sequence };
}
function parse_sequence(sequence) {
    const seq = (typeof sequence === 'string')
        ? parseInt(sequence, 16)
        : sequence;
    if (!Number.isInteger(seq) || seq < 0 || seq > 0xFFFFFFFF) {
        throw new Error(`invalid sequence value: ${seq}`);
    }
    return seq;
}
function parse_stamp(stamp) {
    if (stamp === undefined || !Number.isInteger(stamp)) {
        throw new Error(`timestamp must be a number`);
    }
    const ts = Math.floor(stamp / TIMELOCK_GRANULARITY);
    if (!Number.isInteger(ts) || ts < 0 || ts > TIMELOCK_VALUE_MAX) {
        throw new Error(`timelock value must be an integer between 0 and ${TIMELOCK_VALUE_MAX} (in 512-second increments)`);
    }
    return ts;
}
function parse_height(height) {
    if (height === undefined || !Number.isInteger(height) || height < 0 || height > TIMELOCK_VALUE_MAX) {
        throw new Error(`Heightlock value must be an integer between 0 and ${TIMELOCK_VALUE_MAX}`);
    }
    return height;
}
function parse_short(value = 0) {
    if (!Number.isInteger(value) || value > METADATA_SHORT_MASK) {
        throw new Error(`Value must be an integer between 0 and ${METADATA_SHORT_MASK}`);
    }
    return value;
}
function parse_byte(value = 0) {
    if (!Number.isInteger(value) || value < 0 || value > METADATA_BYTE_MASK) {
        throw new Error(`Value must be an integer between 0 and ${METADATA_BYTE_MASK}`);
    }
    return value;
}
