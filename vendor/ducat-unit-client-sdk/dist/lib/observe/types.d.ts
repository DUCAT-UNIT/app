export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';
export interface LogEvent {
    level: LogLevel;
    name: string;
    time: string;
    message?: string;
    fields?: Record<string, unknown>;
    trace_id?: string;
    span_id?: string;
}
export interface SdkLogger {
    enabled(level: LogLevel): boolean;
    emit(event: LogEvent): void;
}
export interface TraceSpan {
    trace_id: string;
    span_id: string;
    parent_span_id?: string;
    event(name: string, fields?: Record<string, unknown>): void;
    end(fields?: Record<string, unknown>): void;
    fail(error: unknown, fields?: Record<string, unknown>): void;
}
export interface SdkTracer {
    start_span(name: string, fields?: Record<string, unknown>, parent?: TraceSpan): TraceSpan;
}
export interface ObservabilityOptions {
    default_fields?: Record<string, unknown>;
    logger?: SdkLogger;
    tracer?: SdkTracer;
    span?: TraceSpan;
    redact_sensitive?: boolean;
    unsafe_payloads?: boolean;
}
export interface ConsoleLoggerOptions {
    include_time?: boolean;
    json_indent?: number;
    level: LogLevel;
    pretty?: boolean;
    redact_sensitive?: boolean;
}
export interface ObserveContext {
    fields: Record<string, unknown>;
    logger: SdkLogger;
    span?: TraceSpan;
    tracer: SdkTracer;
    redact_sensitive: boolean;
    unsafe_payloads: boolean;
}
