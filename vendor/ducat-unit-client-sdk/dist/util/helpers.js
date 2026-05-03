import { Assert } from './validate.js';
export function now() {
    return Math.floor(Date.now() / 1000);
}
export async function sleep(ms = 1000) {
    return new Promise(res => setTimeout(res, ms));
}
export function get_map_value(terms, key, idx = 0) {
    const value = terms.get(key)?.at(idx);
    Assert.exists(value, 'value is null or undefined: ' + key);
    return value;
}
export function round_to_fixed(float_value, precision) {
    return parseFloat(float_value.toFixed(precision));
}
export function parse_schema(input, schema, error) {
    try {
        return schema.parse(input);
    }
    catch (err) {
        console.error(err);
        if (typeof error === 'string') {
            throw new Error(error);
        }
        else {
            throw err;
        }
    }
}
export function parse_error(err) {
    if (err instanceof Error) {
        return err.message;
    }
    else if (typeof err === 'string') {
        return err;
    }
    else {
        return String(err);
    }
}
export async function resolver(fn, timeout) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject('timeout'), timeout);
        fn().then((res) => {
            clearTimeout(timer);
            resolve(res);
        });
    });
}
export async function safe_exec(fn) {
    try {
        return { ok: true, data: await fn() };
    }
    catch (err) {
        return { ok: false, err };
    }
}
export function normalize_obj(obj) {
    if (obj instanceof Map || Array.isArray(obj) || typeof obj !== 'object') {
        return obj;
    }
    else {
        return Object.keys(obj)
            .sort()
            .filter(([_, value]) => value !== undefined)
            .reduce((sorted, key) => {
            sorted[key] = obj[key];
            return sorted;
        }, {});
    }
}
export function get_record_key(map, type) {
    const ent = Object.entries(map).find(e => e[0] === type);
    if (ent === undefined)
        throw new Error('value does not exist for type: ' + String(type));
    return ent[1];
}
export function get_record_type(map, key) {
    const ent = Object.entries(map).find(e => e[1] === key);
    if (ent === undefined)
        throw new Error('type does not exist for key: ' + key);
    return Number(ent[0]);
}
