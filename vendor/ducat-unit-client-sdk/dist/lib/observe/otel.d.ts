import type { SdkTracer } from './types.js';
export interface OtelTracerAdapterOptions {
    instrumentation_name?: string;
    instrumentation_version?: string;
    redact_sensitive?: boolean;
    unsafe_payloads?: boolean;
}
export declare function create_otel_tracer_adapter(options?: OtelTracerAdapterOptions): SdkTracer;
