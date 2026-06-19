import { create_console_logger } from './console.js';
import { create_multiplex_logger } from './multiplex.js';
import { create_otel_tracer_adapter } from './otel.js';
import { create_ring_buffer_logger } from './ring-buffer.js';
export function create_observability(options = {}) {
    const redact_sensitive = options.redact_sensitive ?? true;
    const unsafe_payloads = options.unsafe_payloads ?? false;
    const level = options.level ?? 'info';
    const include_console = options.console !== false;
    let ring_buffer;
    let logger;
    if (options.logger !== undefined) {
        logger = options.logger;
        if (options.ring_buffer) {
            const buffer_opts = typeof options.ring_buffer === 'object'
                ? options.ring_buffer
                : {};
            ring_buffer = create_ring_buffer_logger({
                redact_sensitive,
                unsafe_payloads,
                ...buffer_opts
            });
        }
    }
    else {
        const sinks = [];
        if (include_console) {
            sinks.push(create_console_logger({ level }));
        }
        if (options.ring_buffer) {
            const buffer_opts = typeof options.ring_buffer === 'object'
                ? options.ring_buffer
                : {};
            ring_buffer = create_ring_buffer_logger({
                redact_sensitive,
                unsafe_payloads,
                ...buffer_opts
            });
            sinks.push(ring_buffer);
        }
        if (sinks.length === 0) {
            logger = create_console_logger({ level });
        }
        else if (sinks.length === 1) {
            logger = sinks[0];
        }
        else {
            logger = create_multiplex_logger({ sinks });
        }
    }
    const tracer = options.tracer ?? create_otel_tracer_adapter({
        redact_sensitive,
        unsafe_payloads,
        ...options.instrumentation
    });
    const assembled = {
        default_fields: options.default_fields,
        logger,
        tracer,
        redact_sensitive,
        unsafe_payloads
    };
    if (ring_buffer !== undefined)
        assembled.ring_buffer = ring_buffer;
    return assembled;
}
