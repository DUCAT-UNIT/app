import type { LogEvent, SdkLogger } from './types.js';
export interface MultiplexLoggerOptions {
    sinks: SdkLogger[];
    on_sink_error?: (error: unknown, sink_index: number, event: LogEvent) => void;
}
export declare function create_multiplex_logger(options: MultiplexLoggerOptions): SdkLogger;
