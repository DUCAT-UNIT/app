import { Resolve } from '@vbyte/util';
import { safe_validate } from '../../lib/validate/index.js';
const DEFAULT_MAX_RESPONSE_AGE_MS = 10 * 60 * 1000;
const PATH_SAFE_SEGMENT = /^[A-Za-z0-9:_-]+$/;
export function safe_path_segment(value, label = 'path segment') {
    if (typeof value !== 'string' || value.length === 0 || !PATH_SAFE_SEGMENT.test(value)) {
        throw new Error(`invalid ${label} for URL path: ${String(value)}`);
    }
    return value;
}
function unwrap_paginated_items(data) {
    if (typeof data !== 'object' || data === null)
        return data;
    const record = data;
    if ('data' in record)
        return record.data;
    return 'items' in record ? record.items : data;
}
export function validate_response_freshness(data, max_age_ms = DEFAULT_MAX_RESPONSE_AGE_MS) {
    if (max_age_ms === 0)
        return undefined;
    if (typeof data !== 'object' || data === null)
        return undefined;
    const record = data;
    const timestamp = record.updated_at ?? record.created_at ?? record.timestamp;
    if (typeof timestamp !== 'number')
        return undefined;
    const ts_ms = timestamp < 1e12 ? timestamp * 1000 : timestamp;
    const now = Date.now();
    const age = now - ts_ms;
    if (age > max_age_ms) {
        return `response is stale: age ${Math.round(age / 1000)}s exceeds max ${Math.round(max_age_ms / 1000)}s`;
    }
    if (age < -max_age_ms) {
        return `response timestamp is too far in the future: ${Math.round(-age / 1000)}s ahead`;
    }
    return undefined;
}
export function validate_fetch_response(schema, data, error_prefix, options) {
    if (options?.max_age_ms !== undefined && options.max_age_ms > 0) {
        const freshness_error = validate_response_freshness(data, options.max_age_ms);
        if (freshness_error) {
            return Resolve.error(`${error_prefix}: ${freshness_error}`);
        }
    }
    const result = safe_validate(schema, data, { error_prefix });
    if (!result.ok)
        return Resolve.error(result.error);
    return Resolve.data(result.data);
}
export function validate_fetch_list_response(schema, data, error_prefix, options) {
    return validate_fetch_response(schema, unwrap_paginated_items(data), error_prefix, options);
}
