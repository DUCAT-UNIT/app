import { Buff } from '@cmdcode/buff';
export var Check;
(function (Check) {
    function exists(value) {
        if (typeof value === 'undefined' || value === null) {
            return false;
        }
        return true;
    }
    Check.exists = exists;
    function is_number(value) {
        return typeof value === 'number';
    }
    Check.is_number = is_number;
    function is_bigint(value) {
        return typeof value === 'bigint';
    }
    Check.is_bigint = is_bigint;
    function is_hex(value) {
        if (typeof value === 'string' &&
            value.match(/[^a-fA-F0-9]/) === null &&
            value.length % 2 === 0) {
            return true;
        }
        return false;
    }
    Check.is_hex = is_hex;
    function is_hash(value) {
        if (is_hex(value) && value.length === 64) {
            return true;
        }
        return false;
    }
    Check.is_hash = is_hash;
    function is_schema(input, schema) {
        return schema.safeParse(input).success;
    }
    Check.is_schema = is_schema;
})(Check || (Check = {}));
export var Assert;
(function (Assert) {
    function ok(value, message) {
        if (value === false) {
            throw new Error(message ?? 'Assertion failed!');
        }
    }
    Assert.ok = ok;
    function exists(value, msg) {
        if (!Check.exists(value)) {
            throw new Error(msg ?? 'Value is null or undefined!');
        }
    }
    Assert.exists = exists;
    function is_number(value) {
        if (!Check.is_number(value)) {
            throw new TypeError(`invalid number: ${String(value)}`);
        }
    }
    Assert.is_number = is_number;
    function is_bigint(value) {
        if (!Check.is_bigint(value)) {
            throw new TypeError(`invalid bigint: ${String(value)}`);
        }
    }
    Assert.is_bigint = is_bigint;
    function is_hex(value) {
        if (!Check.is_hex(value)) {
            throw new TypeError(`invalid hex: ${String(value)}`);
        }
    }
    Assert.is_hex = is_hex;
    function is_hash(value, msg) {
        if (!Check.is_hash(value)) {
            throw new TypeError(msg ?? `invalid hash: ${String(value)}`);
        }
    }
    Assert.is_hash = is_hash;
    function size(input, size) {
        const bytes = Buff.bytes(input);
        if (bytes.length !== size) {
            throw new Error(`Invalid input size: ${bytes.hex} !== ${size}`);
        }
    }
    Assert.size = size;
    function is_schema(input, schema, msg) {
        const result = schema.safeParse(input);
        if (!result.success) {
            console.error(result.error);
            throw new Error(msg ?? 'input failed schema validation');
        }
    }
    Assert.is_schema = is_schema;
})(Assert || (Assert = {}));
