import { Assert, Test } from '@vbyte/util';
export function parse_str_input(input_value, default_value) {
    if (!Test.exists(input_value))
        return default_value;
    Assert.ok(typeof input_value === 'string', 'input value must be a string');
    return input_value;
}
export function parse_int_input(input_value, default_value) {
    if (!Test.exists(input_value))
        return default_value;
    const value = Number(input_value);
    Assert.ok(Number.isInteger(value), 'input value must be an integer');
    return value;
}
