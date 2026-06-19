import type { LogEvent, LogLevel, SdkLogger } from './types.js';
export interface RingBufferLoggerOptions {
    level?: LogLevel;
    max_events?: number;
    max_bytes?: number;
    redact_sensitive?: boolean;
    unsafe_payloads?: boolean;
}
export interface RingBufferLogger extends SdkLogger {
    snapshot(): LogEvent[];
    clear(): void;
    size(): {
        events: number;
        bytes: number;
    };
}
export declare function create_ring_buffer_logger(options?: RingBufferLoggerOptions): RingBufferLogger;
