export const NOOP_SPAN = {
    trace_id: '0'.repeat(32),
    span_id: '0'.repeat(16),
    event: () => { },
    end: () => { },
    fail: () => { }
};
export const NOOP_LOGGER = {
    enabled: (_level) => false,
    emit: (_event) => { }
};
export const NOOP_TRACER = {
    start_span: () => NOOP_SPAN
};
