const ALWAYS_REDACT_KEYS = [
    'private',
    'secret',
    'seckey',
    'sighash'
];
const PAYLOAD_KEYS = [
    'psbt',
    'script'
];
function includes_redacted_key(key, patterns) {
    const lower = key.toLowerCase();
    return patterns.some(pattern => lower.includes(pattern));
}
function summarize_payload(label, value) {
    if (typeof value === 'string') {
        return `[REDACTED_${label} len=${value.length}]`;
    }
    if (value instanceof Uint8Array) {
        return `[REDACTED_${label} len=${value.length}]`;
    }
    return `[REDACTED_${label}]`;
}
function redact_value(key, value, redact_payload) {
    if (value === null || value === undefined) {
        return value;
    }
    if (includes_redacted_key(key, ALWAYS_REDACT_KEYS)) {
        return '[REDACTED]';
    }
    if (redact_payload && includes_redacted_key(key, PAYLOAD_KEYS)) {
        const label = key.toLowerCase().includes('psbt') ? 'PSBT' : 'SCRIPT';
        return summarize_payload(label, value);
    }
    if (Array.isArray(value)) {
        return value.map(entry => redact_value(key, entry, redact_payload));
    }
    if (value instanceof Uint8Array) {
        return redact_payload
            ? summarize_payload('BYTES', value)
            : Array.from(value);
    }
    if (typeof value === 'object') {
        const redacted = {};
        for (const [child_key, child_value] of Object.entries(value)) {
            redacted[child_key] = redact_value(child_key, child_value, redact_payload);
        }
        return redacted;
    }
    return value;
}
export function redact_observe_fields(fields, redact_sensitive, unsafe_payloads) {
    if (!redact_sensitive)
        return fields;
    const redacted = {};
    for (const [key, value] of Object.entries(fields)) {
        redacted[key] = redact_value(key, value, !unsafe_payloads);
    }
    return redacted;
}
