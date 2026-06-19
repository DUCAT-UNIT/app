import { format_zod_error } from './errors.js';
export function parse_schema(input, schema, error) {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
        const detail = format_zod_error(parsed.error);
        throw new Error(error ? `${error}: ${detail}` : `parse_schema failed: ${detail}`);
    }
    return parsed.data;
}
export function assert_schema(input, schema, error) {
    parse_schema(input, schema, error);
}
