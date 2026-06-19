import { type RingBufferLogger, type RingBufferLoggerOptions } from './ring-buffer.js';
import type { OtelTracerAdapterOptions } from './otel.js';
import type { LogLevel, ObservabilityOptions, SdkLogger, SdkTracer } from './types.js';
export interface CreateObservabilityOptions {
    default_fields?: Record<string, unknown>;
    logger?: SdkLogger;
    tracer?: SdkTracer;
    level?: LogLevel;
    console?: boolean;
    ring_buffer?: boolean | RingBufferLoggerOptions;
    redact_sensitive?: boolean;
    unsafe_payloads?: boolean;
    instrumentation?: OtelTracerAdapterOptions;
}
export interface AssembledObservability extends ObservabilityOptions {
    ring_buffer?: RingBufferLogger;
}
export declare function create_observability(options?: CreateObservabilityOptions): AssembledObservability;
