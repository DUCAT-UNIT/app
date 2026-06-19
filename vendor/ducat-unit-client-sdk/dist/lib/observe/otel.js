import { context as otel_context, SpanStatusCode, trace } from '@opentelemetry/api';
import { redact_observe_fields } from './redact.js';
const DEFAULT_INSTRUMENTATION_NAME = 'ducat-client-sdk';
const OTEL_SPAN = Symbol('observe.otel_span');
const MAX_ERROR_MESSAGE_LENGTH = 256;
function truncate_error_message(message) {
    if (message.length <= MAX_ERROR_MESSAGE_LENGTH)
        return message;
    const omitted = message.length - MAX_ERROR_MESSAGE_LENGTH;
    return `${message.slice(0, MAX_ERROR_MESSAGE_LENGTH)}… [truncated ${omitted} chars]`;
}
function is_otel_backed(span) {
    return span !== undefined && OTEL_SPAN in span;
}
function coerce_attribute_value(value) {
    if (value === null || value === undefined)
        return undefined;
    const t = typeof value;
    if (t === 'string' || t === 'number' || t === 'boolean') {
        return value;
    }
    if (Array.isArray(value)) {
        const head = value.find(v => v !== null && v !== undefined);
        const head_t = typeof head;
        if (head_t === 'string' || head_t === 'number' || head_t === 'boolean') {
            return value;
        }
        return JSON.stringify(value);
    }
    try {
        return JSON.stringify(value);
    }
    catch {
        return String(value);
    }
}
function to_otel_attributes(fields) {
    const attrs = {};
    for (const [key, value] of Object.entries(fields)) {
        const coerced = coerce_attribute_value(value);
        if (coerced !== undefined)
            attrs[key] = coerced;
    }
    return attrs;
}
export function create_otel_tracer_adapter(options = {}) {
    const redact_sensitive = options.redact_sensitive ?? true;
    const unsafe_payloads = options.unsafe_payloads ?? false;
    const tracer = trace.getTracer(options.instrumentation_name ?? DEFAULT_INSTRUMENTATION_NAME, options.instrumentation_version);
    function redact(fields) {
        return redact_observe_fields(fields, redact_sensitive, unsafe_payloads);
    }
    return {
        start_span(name, fields = {}, parent) {
            const safe_fields = redact(fields);
            const attributes = to_otel_attributes(safe_fields);
            const parent_ctx = is_otel_backed(parent)
                ? trace.setSpan(otel_context.active(), parent[OTEL_SPAN])
                : otel_context.active();
            const otel_span = tracer.startSpan(name, { attributes }, parent_ctx);
            const sc = otel_span.spanContext();
            const span = {
                [OTEL_SPAN]: otel_span,
                trace_id: sc.traceId,
                span_id: sc.spanId,
                parent_span_id: parent?.span_id,
                event(event_name, event_fields = {}) {
                    const safe = redact(event_fields);
                    otel_span.addEvent(event_name, to_otel_attributes(safe));
                },
                end(end_fields = {}) {
                    const safe = redact(end_fields);
                    if (Object.keys(safe).length > 0) {
                        otel_span.setAttributes(to_otel_attributes(safe));
                    }
                    otel_span.end();
                },
                fail(error, fail_fields = {}) {
                    const safe = redact(fail_fields);
                    if (Object.keys(safe).length > 0) {
                        otel_span.setAttributes(to_otel_attributes(safe));
                    }
                    const name = (error instanceof Error) ? error.name : 'Error';
                    const raw_message = (error instanceof Error) ? error.message : String(error);
                    if (redact_sensitive) {
                        const message = truncate_error_message(raw_message);
                        otel_span.recordException({ name, message });
                        otel_span.setStatus({ code: SpanStatusCode.ERROR, message });
                    }
                    else {
                        if (error instanceof Error) {
                            otel_span.recordException(error);
                        }
                        else {
                            otel_span.recordException({ name, message: raw_message });
                        }
                        otel_span.setStatus({ code: SpanStatusCode.ERROR, message: raw_message });
                    }
                    otel_span.end();
                }
            };
            return span;
        }
    };
}
