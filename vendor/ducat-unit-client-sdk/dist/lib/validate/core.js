import { ValidationError } from '../../lib/errors/index.js';
import { format_validation_message } from './util.js';
export function validate(schema, data, error_prefix) {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
        const message = format_validation_message(parsed.error, error_prefix);
        throw new ValidationError(message, { zod_error: parsed.error });
    }
    return parsed.data;
}
export function safe_validate(schema, data, options = {}) {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
        const message = format_validation_message(parsed.error, options.error_prefix);
        return { ok: false, error: parsed.error, message };
    }
    return { ok: true, data: parsed.data };
}
export function assert_valid(schema, data, error_prefix) {
    validate(schema, data, error_prefix);
}
