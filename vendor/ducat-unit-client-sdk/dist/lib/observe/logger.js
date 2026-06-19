import { redact_observe_fields } from './redact.js';
function format_error(error) {
    if (error instanceof Error) {
        return {
            error_message: error.message,
            error_name: error.name
        };
    }
    return {
        error_message: String(error),
        error_name: 'Error'
    };
}
function emit_log(context, level, name, message, fields) {
    if (!context.logger.enabled(level))
        return;
    const merged = redact_observe_fields({ ...context.fields, ...fields }, context.redact_sensitive, context.unsafe_payloads);
    context.logger.emit({
        level,
        name,
        time: new Date().toISOString(),
        fields: merged,
        message,
        span_id: context.span?.span_id,
        trace_id: context.span?.trace_id
    });
}
export function emit_debug(context, name, fields = {}) {
    emit_log(context, 'debug', name, undefined, fields);
}
export function emit_error(context, name, message, error, fields = {}) {
    emit_log(context, 'error', name, message, { ...fields, ...format_error(error) });
}
export function emit_info(context, name, message, fields = {}) {
    emit_log(context, 'info', name, message, fields);
}
export function emit_warn(context, name, message, fields = {}) {
    emit_log(context, 'warn', name, message, fields);
}
