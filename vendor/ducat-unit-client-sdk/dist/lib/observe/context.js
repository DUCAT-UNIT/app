import { NOOP_LOGGER, NOOP_TRACER } from './noop.js';
import { create_otel_tracer_adapter } from './otel.js';
function is_observe_context(value) {
    return (typeof value === 'object' &&
        value !== null &&
        'fields' in value &&
        'logger' in value &&
        'tracer' in value);
}
function get_tracer(options, logger) {
    if (options?.tracer)
        return options.tracer;
    if (logger === NOOP_LOGGER)
        return NOOP_TRACER;
    return create_otel_tracer_adapter({
        redact_sensitive: options?.redact_sensitive ?? true,
        unsafe_payloads: options?.unsafe_payloads ?? false
    });
}
export function get_observe_context(options, default_fields = {}) {
    if (is_observe_context(options)) {
        return {
            ...options,
            fields: { ...options.fields, ...default_fields }
        };
    }
    const logger = options?.logger ?? NOOP_LOGGER;
    return {
        fields: { ...options?.default_fields, ...default_fields },
        logger,
        span: options?.span,
        tracer: get_tracer(options, logger),
        redact_sensitive: options?.redact_sensitive ?? true,
        unsafe_payloads: options?.unsafe_payloads ?? false
    };
}
export function child_observe_context(context, fields = {}, span = context.span) {
    return {
        ...context,
        fields: { ...context.fields, ...fields },
        span
    };
}
export function with_observe_span(context, name, fields, fn) {
    const span = context.tracer.start_span(name, fields, context.span);
    const scope = child_observe_context(context, fields, span);
    try {
        const result = fn(scope);
        if (result instanceof Promise) {
            return result.then(value => {
                span.end();
                return value;
            }).catch(error => {
                span.fail(error);
                throw error;
            });
        }
        span.end();
        return result;
    }
    catch (error) {
        span.fail(error);
        throw error;
    }
}
